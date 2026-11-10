import "server-only";
import type {
  AuditEvent,
  Booking,
  BookingServiceLine,
  BookingStatus,
  Customer,
  Database,
  Kobo,
  Payment,
  Service,
  Settings,
} from "@/domain/types";
import { isSlotBookable } from "@/domain/availability";
import { balanceDue, depositFor, estimateServices } from "@/domain/pricing";
import { normalizeNigerianPhone, validateContact } from "@/domain/validation";
import { formatNaira } from "@/lib/money";
import { transaction } from "./store";
import { newAccessToken, newBookingReference, newId } from "./ids";
import { initializeCheckout, resolveCheckout } from "./payments/mock-checkout-adapter";

/**
 * Booking rules and orchestration. Every mutation goes through
 * `transaction()` so checks and writes happen atomically.
 */

export class BookingError extends Error {
  constructor(
    public code:
      | "VALIDATION"
      | "SLOT_TAKEN"
      | "NOT_FOUND"
      | "HOLD_EXPIRED"
      | "NOT_ALLOWED"
      | "NOTHING_DUE",
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

function audit(db: Database, e: Omit<AuditEvent, "id" | "at"> & { at?: string }): void {
  db.audit.push({ id: newId("aud"), at: e.at ?? new Date().toISOString(), ...e });
}

/** Lazily release unpaid holds whose time has passed. */
export function sweepExpiredHolds(db: Database, nowMs: number): void {
  for (const b of db.bookings) {
    if (b.status === "awaiting_deposit" && b.holdExpiresAt && Date.parse(b.holdExpiresAt) <= nowMs) {
      b.status = "expired";
      for (const p of db.payments) {
        if (p.bookingId === b.id && p.state === "pending") {
          p.state = "abandoned";
          p.resolvedAt = new Date(nowMs).toISOString();
        }
      }
      audit(db, { bookingId: b.id, customerId: b.customerId, action: "booking.expired", actor: "System", summary: `Unpaid hold on ${b.reference} ended; slot released` });
    }
  }
}

function findOrCreateCustomer(db: Database, name: string, phone: string | null, email: string | null, nowIso: string): Customer {
  const existing = db.customers.find(
    (c) => (phone && c.phone === phone) || (email && c.email && c.email.toLowerCase() === email.toLowerCase()),
  );
  if (existing) {
    // Fill in any newly provided contact method; keep the stored name.
    if (phone && !existing.phone) existing.phone = phone;
    if (email && !existing.email) existing.email = email;
    return existing;
  }
  const customer: Customer = { id: newId("cus"), name, phone, email, createdAt: nowIso, privateNotes: "", isDemo: true };
  db.customers.push(customer);
  return customer;
}

function snapshotLine(service: Service, settings: Settings): BookingServiceLine {
  return {
    id: newId("line"),
    serviceId: service.id,
    kind: "booked",
    name: service.name,
    serviceStatus: service.status,
    estimatedPriceKobo: service.priceKobo,
    estimatedDurationMinutes: service.durationMinutes ?? settings.availability.defaultDurationMinutes,
    delivered: false,
    actualPriceKobo: null,
    addOnNote: "",
  };
}

export interface CreateBookingInput {
  serviceIds: string[];
  startAt: string;
  name: string;
  phone: string;
  email: string;
  customerNote: string;
}

/** Re-checks the slot, holds it, and opens a deposit checkout — atomically. */
export function createPendingBooking(input: CreateBookingInput) {
  const fieldErrors = validateContact(input);
  if (Object.keys(fieldErrors).length) {
    throw new BookingError("VALIDATION", "Please check your details.", fieldErrors as Record<string, string>);
  }
  if (!Array.isArray(input.serviceIds) || input.serviceIds.length === 0) {
    throw new BookingError("VALIDATION", "Choose at least one service.");
  }
  if (Number.isNaN(Date.parse(input.startAt))) {
    throw new BookingError("VALIDATION", "Choose an appointment time.");
  }

  return transaction((db) => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    sweepExpiredHolds(db, nowMs);

    const services = [...new Set(input.serviceIds)]
      .map((id) => db.services.find((s) => s.id === id && s.active))
      .filter((s): s is Service => Boolean(s));
    if (services.length !== new Set(input.serviceIds).size) {
      throw new BookingError("VALIDATION", "One of the selected services is no longer available. Please review your selection.");
    }

    const { availability, deposit } = db.settings;
    const est = estimateServices(services, availability.defaultDurationMinutes);
    if (!isSlotBookable({ startAt: input.startAt, durationMinutes: est.durationMinutes, config: availability, bookings: db.bookings, nowMs })) {
      throw new BookingError("SLOT_TAKEN", "Sorry — that time has just been taken or is no longer available. Please choose another time.");
    }

    const phone = input.phone.trim() ? normalizeNigerianPhone(input.phone) : null;
    const email = input.email.trim() ? input.email.trim().toLowerCase() : null;
    const customer = findOrCreateCustomer(db, input.name.trim(), phone, email, nowIso);

    let reference = newBookingReference();
    while (db.bookings.some((b) => b.reference === reference)) reference = newBookingReference();

    const startMs = Date.parse(input.startAt);
    const booking: Booking = {
      id: newId("bkg"),
      reference,
      accessToken: newAccessToken(),
      customerId: customer.id,
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(startMs + est.durationMinutes * 60_000).toISOString(),
      status: "awaiting_deposit",
      createdAt: nowIso,
      holdExpiresAt: new Date(nowMs + availability.pendingHoldMinutes * 60_000).toISOString(),
      estimatedTotalKobo: est.totalKobo,
      hasUnpricedItems: est.hasUnpricedItems,
      depositDueKobo: depositFor(est.totalKobo, deposit),
      actualTotalKobo: null,
      lines: services.map((s) => snapshotLine(s, db.settings)),
      customerNote: input.customerNote.trim().slice(0, 500),
      completionNote: "",
      privateNote: "",
      completedAt: null,
      isDemo: true,
    };
    db.bookings.push(booking);
    audit(db, { bookingId: booking.id, customerId: customer.id, action: "booking.created", actor: "Customer", summary: `Booking ${reference} created; slot held for ${availability.pendingHoldMinutes} min awaiting deposit` });

    const payment = initializeCheckout(db, { booking, purpose: "deposit", amountKobo: booking.depositDueKobo, nowIso });
    audit(db, { bookingId: booking.id, customerId: customer.id, action: "payment.deposit.initialized", actor: "System", summary: `Demo deposit checkout ${payment.reference} opened` });

    return { reference: booking.reference, accessToken: booking.accessToken, checkoutReference: payment.reference };
  });
}

export type CheckoutResult =
  | { status: "success" | "failed"; alreadyResolved: boolean; bookingReference: string; accessToken: string }
  | { status: "expired"; bookingReference: string; accessToken: string };

/** Applies a simulated gateway outcome. Safe to call repeatedly with the same reference. */
export function completeMockCheckout(checkoutReference: string, outcome: "success" | "failed"): CheckoutResult {
  return transaction((db) => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const payment = db.payments.find((p) => p.reference === checkoutReference);
    if (!payment) throw new BookingError("NOT_FOUND", "We couldn't find that checkout.");
    const booking = db.bookings.find((b) => b.id === payment.bookingId)!;

    // A deposit checkout cannot succeed after its hold has ended.
    if (payment.state === "pending" && payment.purpose === "deposit") {
      sweepExpiredHolds(db, nowMs);
      if (booking.status === "expired") {
        return { status: "expired", bookingReference: booking.reference, accessToken: booking.accessToken };
      }
      if (booking.status !== "awaiting_deposit") {
        // Deposit already settled another way (or booking cancelled): never take it twice.
        payment.state = "abandoned";
        payment.resolvedAt = nowIso;
        throw new BookingError("NOT_ALLOWED", "This deposit checkout is no longer needed for this booking.");
      }
    }

    const result = resolveCheckout(db, checkoutReference, outcome, nowIso);
    if (!result) throw new BookingError("NOT_FOUND", "We couldn't find that checkout.");
    const { payment: p, alreadyResolved } = result;
    if (p.state === "abandoned") {
      return { status: "expired", bookingReference: booking.reference, accessToken: booking.accessToken };
    }

    if (!alreadyResolved) {
      const label = p.purpose === "deposit" ? "deposit" : "balance";
      audit(db, {
        bookingId: booking.id,
        customerId: booking.customerId,
        action: `payment.${p.purpose}.${p.state}`,
        actor: "Mock checkout",
        summary: p.state === "success" ? `Demo ${label} payment ${p.reference} succeeded` : `Demo ${label} payment ${p.reference} failed`,
      });
      if (p.state === "success" && p.purpose === "deposit" && booking.status === "awaiting_deposit") {
        booking.status = "confirmed";
        booking.holdExpiresAt = null;
        audit(db, { bookingId: booking.id, customerId: booking.customerId, action: "booking.confirmed", actor: "System", summary: `Booking ${booking.reference} confirmed after demo deposit` });
      }
    }
    return { status: p.state as "success" | "failed", alreadyResolved, bookingReference: booking.reference, accessToken: booking.accessToken };
  });
}

/** Opens (or reuses) a checkout for the deposit or the outstanding balance. */
export function startCheckout(bookingReference: string, accessToken: string | null, purpose: "deposit" | "balance", actor = "Customer") {
  return transaction((db) => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    sweepExpiredHolds(db, nowMs);
    const booking = db.bookings.find((b) => b.reference === bookingReference);
    if (!booking || (accessToken !== null && booking.accessToken !== accessToken)) {
      throw new BookingError("NOT_FOUND", "We couldn't find that booking.");
    }
    const payments = db.payments.filter((p) => p.bookingId === booking.id);

    let amount: Kobo;
    if (purpose === "deposit") {
      if (booking.status === "expired") throw new BookingError("HOLD_EXPIRED", "The hold on this time has ended. Please book again.");
      if (booking.status !== "awaiting_deposit") throw new BookingError("NOT_ALLOWED", "The deposit for this booking is already settled.");
      amount = booking.depositDueKobo;
    } else {
      const due = balanceDue(booking, payments);
      if (due === null) throw new BookingError("NOT_ALLOWED", "The salon hasn't recorded the final total yet.");
      if (due === 0) throw new BookingError("NOTHING_DUE", "Nothing is owed on this booking.");
      amount = due;
    }

    // Reuse an open checkout for the same purpose and amount rather than piling up references.
    const open = payments.find((p) => p.state === "pending" && p.purpose === purpose && p.amountKobo === amount);
    if (open) return { checkoutReference: open.reference };

    // Close any stale pending checkout for this purpose (amount changed).
    for (const p of payments) {
      if (p.state === "pending" && p.purpose === purpose) {
        p.state = "abandoned";
        p.resolvedAt = nowIso;
      }
    }
    const payment = initializeCheckout(db, { booking, purpose, amountKobo: amount, nowIso });
    audit(db, { bookingId: booking.id, customerId: booking.customerId, action: `payment.${purpose}.initialized`, actor, summary: `Demo ${purpose} checkout ${payment.reference} opened` });
    return { checkoutReference: payment.reference };
  });
}

/* ───────────────────────────── Admin actions ───────────────────────────── */

const ADMIN = "Owner (demo admin)";

function getBooking(db: Database, id: string): Booking {
  const b = db.bookings.find((x) => x.id === id);
  if (!b) throw new BookingError("NOT_FOUND", "Booking not found.");
  return b;
}

export interface CompletionInput {
  lines: { id: string; delivered: boolean; actualPriceKobo: Kobo | null; addOnNote: string }[];
  extras: { name: string; priceKobo: Kobo; note: string }[];
  actualTotalKobo: Kobo;
  completionNote: string;
}

export function recordCompletion(bookingId: string, input: CompletionInput) {
  return transaction((db) => {
    const b = getBooking(db, bookingId);
    if (!["confirmed", "completed"].includes(b.status)) {
      throw new BookingError("NOT_ALLOWED", "Only confirmed or completed bookings can be completed.");
    }
    if (!Number.isInteger(input.actualTotalKobo) || input.actualTotalKobo < 0) {
      throw new BookingError("VALIDATION", "Enter a valid actual total.");
    }
    const prevTotal = b.actualTotalKobo;
    const booked = b.lines.filter((l) => l.kind === "booked").map((l) => {
      const u = input.lines.find((x) => x.id === l.id);
      return u ? { ...l, delivered: u.delivered, actualPriceKobo: u.delivered ? u.actualPriceKobo : null, addOnNote: u.addOnNote.trim() } : l;
    });
    const extras: BookingServiceLine[] = input.extras
      .filter((e) => e.name.trim())
      .map((e) => ({
        id: newId("line"),
        serviceId: null,
        kind: "extra",
        name: e.name.trim().slice(0, 80),
        serviceStatus: "demo",
        estimatedPriceKobo: null,
        estimatedDurationMinutes: 0,
        delivered: true,
        actualPriceKobo: e.priceKobo,
        addOnNote: e.note.trim(),
      }));
    b.lines = [...booked, ...extras];
    b.actualTotalKobo = input.actualTotalKobo;
    b.completionNote = input.completionNote.trim().slice(0, 1000);
    const wasCompleted = b.status === "completed";
    b.status = "completed";
    b.completedAt = b.completedAt ?? new Date().toISOString();

    const payments = db.payments.filter((p) => p.bookingId === b.id);
    const due = balanceDue(b, payments)!;
    const delivered = b.lines.filter((l) => l.delivered).map((l) => l.name).join(", ") || "none";
    audit(db, {
      bookingId: b.id,
      customerId: b.customerId,
      action: wasCompleted ? "booking.completion_updated" : "booking.completed",
      actor: ADMIN,
      summary: `${wasCompleted ? "Updated" : "Recorded"} actual total ${formatNaira(input.actualTotalKobo)}${prevTotal === null ? "" : ` (was ${formatNaira(prevTotal)})`}; delivered: ${delivered}; balance now ${formatNaira(due)}`,
    });
    return { balanceDueKobo: due };
  });
}

export function setBookingStatus(bookingId: string, status: Extract<BookingStatus, "cancelled" | "no_show" | "confirmed">) {
  return transaction((db) => {
    const b = getBooking(db, bookingId);
    const allowed: Record<string, BookingStatus[]> = {
      cancelled: ["awaiting_deposit", "confirmed"],
      no_show: ["confirmed"],
      confirmed: ["cancelled", "no_show"],
    };
    if (!allowed[status].includes(b.status)) {
      throw new BookingError("NOT_ALLOWED", `A ${b.status.replace("_", " ")} booking can't be changed to ${status.replace("_", " ")}.`);
    }
    if (status === "confirmed") {
      // Reinstating must not create an overlap.
      const others = db.bookings.filter((x) => x.id !== b.id);
      const mins = (Date.parse(b.endAt) - Date.parse(b.startAt)) / 60_000;
      const clash = others.some((x) => ["confirmed", "completed"].includes(x.status) && Date.parse(x.startAt) < Date.parse(b.startAt) + mins * 60_000 && Date.parse(b.startAt) < Date.parse(x.endAt));
      if (clash) throw new BookingError("SLOT_TAKEN", "Another booking now occupies this time, so it can't be reinstated.");
      const paid = db.payments.some((p) => p.bookingId === b.id && p.state === "success");
      if (!paid) throw new BookingError("NOT_ALLOWED", "This booking has no successful deposit, so it can't be reinstated as confirmed.");
    }
    const prev = b.status;
    b.status = status;
    b.holdExpiresAt = null;
    for (const p of db.payments) {
      if (p.bookingId === b.id && p.state === "pending") {
        p.state = "abandoned";
        p.resolvedAt = new Date().toISOString();
      }
    }
    audit(db, { bookingId: b.id, customerId: b.customerId, action: `booking.${status}`, actor: ADMIN, summary: `Status changed from ${prev.replace("_", " ")} to ${status.replace("_", " ")}` });
  });
}

export function updateBookingNotes(bookingId: string, privateNote: string) {
  return transaction((db) => {
    const b = getBooking(db, bookingId);
    b.privateNote = privateNote.trim().slice(0, 2000);
    audit(db, { bookingId: b.id, customerId: b.customerId, action: "booking.private_note", actor: ADMIN, summary: "Private booking note updated" });
  });
}

export function updateCustomerNotes(customerId: string, notes: string) {
  return transaction((db) => {
    const c = db.customers.find((x) => x.id === customerId);
    if (!c) throw new BookingError("NOT_FOUND", "Customer not found.");
    c.privateNotes = notes.trim().slice(0, 4000);
    audit(db, { bookingId: null, customerId: c.id, action: "customer.private_note", actor: ADMIN, summary: "Private customer note updated" });
  });
}

export function recordManualPayment(bookingId: string, input: { amountKobo: Kobo; method: string; note: string; purpose: "deposit" | "balance" }) {
  return transaction((db) => {
    const b = getBooking(db, bookingId);
    if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) throw new BookingError("VALIDATION", "Enter an amount above ₦0.");
    if (!input.method.trim()) throw new BookingError("VALIDATION", "Say how the payment was received.");
    const nowIso = new Date().toISOString();
    const payment: Payment = {
      id: newId("pay"),
      bookingId: b.id,
      customerId: b.customerId,
      amountKobo: input.amountKobo,
      purpose: "manual",
      state: "success",
      source: "manual_entry",
      reference: `MANUAL-${Date.now().toString(36).toUpperCase()}`,
      createdAt: nowIso,
      resolvedAt: nowIso,
      method: input.method.trim().slice(0, 40),
      note: `${input.purpose === "deposit" ? "Towards deposit. " : ""}${input.note.trim()}`.slice(0, 500),
      recordedBy: ADMIN,
      isDemo: true,
    };
    db.payments.push(payment);
    // A manual deposit confirms an awaiting booking (owner's call, recorded in audit).
    if (input.purpose === "deposit" && b.status === "awaiting_deposit") {
      b.status = "confirmed";
      b.holdExpiresAt = null;
    }
    audit(db, { bookingId: b.id, customerId: b.customerId, action: "payment.manual.recorded", actor: ADMIN, summary: `Manual ${input.method.trim()} payment of ${formatNaira(input.amountKobo)} recorded (not gateway-verified)` });
  });
}

/* ──────────────────────────── Settings actions ─────────────────────────── */

export function upsertService(input: Omit<Service, "sortOrder"> & { sortOrder?: number }) {
  return transaction((db) => {
    const existing = db.services.find((s) => s.id === input.id);
    if (existing) {
      Object.assign(existing, { ...input, sortOrder: existing.sortOrder });
      audit(db, { bookingId: null, customerId: null, action: "service.updated", actor: ADMIN, summary: `Service “${input.name}” updated (existing bookings keep their snapshot)` });
    } else {
      const sortOrder = Math.max(0, ...db.services.map((s) => s.sortOrder)) + 1;
      db.services.push({ ...input, id: newId("svc"), sortOrder });
      audit(db, { bookingId: null, customerId: null, action: "service.created", actor: ADMIN, summary: `Service “${input.name}” added` });
    }
  });
}

export function updateSettings(patch: Partial<Pick<Settings, "availability" | "deposit">>) {
  return transaction((db) => {
    if (patch.availability) db.settings.availability = { ...db.settings.availability, ...patch.availability };
    if (patch.deposit) db.settings.deposit = { ...db.settings.deposit, ...patch.deposit };
    audit(db, { bookingId: null, customerId: null, action: "settings.updated", actor: ADMIN, summary: `Updated ${Object.keys(patch).join(" & ")} settings (demo values)` });
  });
}

export function toggleChecklistItem(id: string, done: boolean) {
  return transaction((db) => {
    const item = db.settings.checklist.find((c) => c.id === id);
    if (item) item.done = done;
  });
}
