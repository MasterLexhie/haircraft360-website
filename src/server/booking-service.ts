import "server-only";
import type { BookingStatus, Kobo, PaymentMethod, Settings } from "@/domain/types";
import { isSlotBookable } from "@/domain/availability";
import { depositDue } from "@/domain/deposit";
import { addOnTerms, balanceDue, itemsDuration, itemsTotal } from "@/domain/pricing";
import { normalizeEmail, normalizePhone, placeholderEmailFor } from "@/domain/phone";
import { validateContact } from "@/domain/validation";
import { formatNaira } from "@/lib/money";
import { addDays, lagosDateKey, lagosToUtcMs } from "@/lib/time";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { db, type Db, type Tx } from "./db";
import { audit } from "./audit";
import { matchOrCreateCustomer } from "./customers";
import { loadSettings } from "./settings";
import { newBookingReference } from "./ids";
import { toBooking } from "./mappers";

/**
 * Booking rules and orchestration. Every change runs in one database transaction,
 * so checks and writes commit together or not at all.
 */

export class BookingError extends Error {
  constructor(
    public code: "VALIDATION" | "SLOT_TAKEN" | "NOT_FOUND" | "HOLD_EXPIRED" | "NOT_ALLOWED" | "NOTHING_DUE" | "TOO_MANY_HOLDS",
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

/** How long a customer's booking link keeps working after the appointment. */
const ACCESS_DAYS_AFTER_APPOINTMENT = 30;
/** One unpaid hold per phone number at a time (stops calendar blocking). */
const MAX_ACTIVE_HOLDS_PER_PHONE = 1;
const DAY_MS = 86_400_000;

/* ───────────────────────────── Locking and capacity ───────────────────────────── */

/**
 * Serialises every change that could affect capacity on one salon day.
 * Transaction-level, so it is released on commit or rollback and works through
 * Supabase's transaction-mode pooler.
 */
export async function lockSalonDay(tx: Tx, dateKey: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`salon-day:${dateKey}`}))`;
}

/**
 * Bookings and Blocks that could affect availability between two instants.
 * Shared by the booking service (inside the day lock) and the public availability route.
 */
export async function occupancyBetween(client: Tx | Db, from: Date, to: Date) {
  const [rows, blocks] = await Promise.all([
    client.booking.findMany({
      where: { startAt: { lt: to }, endAt: { gt: from }, status: { in: ["confirmed", "completed", "pending_payment"] } },
      select: { id: true, status: true, startAt: true, endAt: true, holdExpiresAt: true },
    }),
    client.block.findMany({ where: { startAt: { lt: to }, endAt: { gt: from } }, select: { startAt: true, endAt: true, capacityReduction: true } }),
  ]);
  return {
    bookings: rows.map((r) => ({
      id: r.id,
      status: r.status,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      holdExpiresAt: r.holdExpiresAt?.toISOString() ?? null,
    })),
    blocks: blocks.map((b) => ({ startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString(), capacityReduction: b.capacityReduction })),
  };
}

/** Everything that could overlap a day (with a day of margin either side for long bookings and buffers). */
function occupancyAround(tx: Tx, dateKey: string) {
  return occupancyBetween(tx, new Date(lagosToUtcMs(addDays(dateKey, -1), 0)), new Date(lagosToUtcMs(addDays(dateKey, 2), 0)));
}

/** True when the booking's own time still fits (it is excluded from the count). Caller holds the day lock. */
async function timeStillFree(tx: Tx, settings: Settings, booking: { id: string; startAt: Date; endAt: Date }, nowMs: number): Promise<boolean> {
  const dateKey = lagosDateKey(booking.startAt);
  const durationMinutes = Math.round((booking.endAt.getTime() - booking.startAt.getTime()) / 60_000);
  return isSlotBookable({
    startAt: booking.startAt.toISOString(),
    durationMinutes,
    config: { ...settings.availability, minimumLeadMinutes: 0 },
    ...(await occupancyAround(tx, dateKey)),
    nowMs,
    excludeBookingId: booking.id,
  });
}

/* ───────────────────────────── Create (customer) ───────────────────────────── */

export interface CreateBookingInput {
  mainServiceId: string;
  addOnIds: string[];
  startAt: string;
  name: string;
  phone: string;
  email: string;
  noEmail: boolean;
  marketingConsent: boolean;
  customerNote: string;
}

export interface CreatedBooking {
  reference: string;
  /** Raw token for the customer's link. Only its hash is stored; it is never shown again. */
  accessToken: string;
  depositDueKobo: Kobo;
}

/** Validates, re-checks the time under the day lock, holds it and records the booking. */
export async function createPendingBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const fieldErrors = validateContact(input);
  if (Object.keys(fieldErrors).length) {
    throw new BookingError("VALIDATION", "Please check your details.", fieldErrors as Record<string, string>);
  }
  if (Number.isNaN(Date.parse(input.startAt))) throw new BookingError("VALIDATION", "Choose an appointment time.");
  const phone = normalizePhone(input.phone)!;
  const domain = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost").hostname;
  const email = input.noEmail ? placeholderEmailFor(phone, domain) : normalizeEmail(input.email);
  const name = input.name.trim().replace(/\s+/g, " ");
  const addOnIds = [...new Set(input.addOnIds)];

  const main = await db.service.findFirst({ where: { id: input.mainServiceId, active: true, bookableAlone: true }, include: { addOns: true } });
  if (!main) throw new BookingError("VALIDATION", "That service is no longer available. Please choose again.");
  const allowed = new Set(main.addOns.map((a) => a.addOnServiceId));
  const addOns = await db.service.findMany({ where: { id: { in: addOnIds }, active: true, availableAsAddOn: true } });
  if (addOns.length !== addOnIds.length || addOns.some((a) => !allowed.has(a.id))) {
    throw new BookingError("VALIDATION", "One of the extras is no longer available with this service. Please review your choice.");
  }

  // Prices come from the database, never from the browser.
  const items = [
    { kind: "main" as const, serviceId: main.id, name: main.name, priceKobo: main.priceKobo, durationMinutes: main.durationMinutes },
    ...addOnIds.map((id) => {
      const a = addOns.find((x) => x.id === id)!;
      return { kind: "add_on" as const, serviceId: a.id, name: a.name, ...addOnTerms(a) };
    }),
  ];
  const totalKobo = itemsTotal(items);
  const duration = itemsDuration(items);
  const startAt = new Date(input.startAt);
  const endAt = new Date(startAt.getTime() + duration * 60_000);
  const accessToken = randomToken();
  const accessTokenHash = await sha256Hex(accessToken);

  return db.$transaction(async (tx) => {
    const nowMs = Date.now();
    const now = new Date(nowMs);
    const settings = await loadSettings(tx);
    const dateKey = lagosDateKey(startAt);
    await lockSalonDay(tx, dateKey);

    const holds = await tx.booking.count({ where: { contactPhone: phone, status: "pending_payment", holdExpiresAt: { gt: now } } });
    if (holds >= MAX_ACTIVE_HOLDS_PER_PHONE) {
      throw new BookingError("TOO_MANY_HOLDS", "You already have a booking waiting for its deposit. Please finish that payment first, or wait a few minutes for it to expire.");
    }

    const bookable = isSlotBookable({ startAt: startAt.toISOString(), durationMinutes: duration, config: settings.availability, ...(await occupancyAround(tx, dateKey)), nowMs });
    if (!bookable) throw new BookingError("SLOT_TAKEN", "Sorry, that time was just taken or is no longer available. Please choose another time.");

    const match = await matchOrCreateCustomer(tx, { name, phone, email, emailIsPlaceholder: input.noEmail, marketingConsent: input.marketingConsent }, now);

    let reference = newBookingReference();
    while (await tx.booking.findUnique({ where: { reference }, select: { id: true } })) reference = newBookingReference();

    const depositDueKobo = depositDue({ mainServiceKobo: main.priceKobo, totalKobo }, settings.deposit);
    const booking = await tx.booking.create({
      data: {
        reference,
        accessTokenHash,
        accessExpiresAt: new Date(endAt.getTime() + ACCESS_DAYS_AFTER_APPOINTMENT * DAY_MS),
        customerId: match.customerId,
        contactName: name,
        contactPhone: phone,
        contactEmail: input.noEmail ? null : email,
        startAt,
        endAt,
        status: "pending_payment",
        holdExpiresAt: new Date(nowMs + settings.availability.holdMinutes * 60_000),
        totalKobo,
        depositDueKobo,
        customerNote: input.customerNote.trim().slice(0, 500),
        items: { create: items },
      },
    });
    await audit(tx, {
      action: "booking.created",
      actorLabel: "Customer",
      entityType: "Booking",
      entityId: booking.id,
      bookingId: booking.id,
      customerId: match.customerId,
      summary: `Booking ${reference} created; time held for ${settings.availability.holdMinutes} min awaiting the deposit${match.emailConflictCustomerId ? ". The email belongs to another customer record (possible duplicate)" : ""}`,
      data: match.emailConflictCustomerId ? { emailConflictCustomerId: match.emailConflictCustomerId } : undefined,
    });
    return { reference, accessToken, depositDueKobo };
  });
}

/* ───────────────────────────── Confirm after payment ───────────────────────────── */

export interface ReceivedPayment {
  type: "deposit" | "balance_online";
  method: PaymentMethod;
  amountKobo: Kobo;
  paystackReference: string;
  actorLabel: string;
}

/**
 * Records money received online and, for a deposit, confirms the booking.
 * Runs inside the caller's transaction. Idempotent: a reference already in the
 * ledger changes nothing (the unique index makes a duplicate impossible).
 *
 * Late payment (hold expired): confirms if the time is still free, otherwise
 * `needs_attention` so the owner can move the booking (the salon does not refund deposits).
 */
export async function recordOnlinePayment(tx: Tx, bookingId: string, payment: ReceivedPayment): Promise<{ duplicate: boolean; status: BookingStatus }> {
  const existing = await tx.payment.findUnique({ where: { paystackReference: payment.paystackReference } });
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (existing) return { duplicate: true, status: booking.status };

  await lockSalonDay(tx, lagosDateKey(booking.startAt));
  const nowMs = Date.now();
  await tx.payment.create({
    data: { bookingId, type: payment.type, method: payment.method, amountKobo: payment.amountKobo, paystackReference: payment.paystackReference },
  });

  let status = booking.status;
  if (payment.type === "deposit" && (booking.status === "pending_payment" || booking.status === "expired")) {
    const holdLive = booking.status === "pending_payment" && booking.holdExpiresAt !== null && booking.holdExpiresAt.getTime() > nowMs;
    const settings = await loadSettings(tx);
    status = holdLive || (await timeStillFree(tx, settings, booking, nowMs)) ? "confirmed" : "needs_attention";
    await tx.booking.update({ where: { id: bookingId }, data: { status, holdExpiresAt: null } });
    if (status === "confirmed") await createBookingNotifications(tx, bookingId);
  }
  await audit(tx, {
    action: `payment.${payment.type}.received`,
    actorLabel: payment.actorLabel,
    entityType: "Booking",
    entityId: bookingId,
    bookingId,
    customerId: booking.customerId,
    summary: `${payment.type === "deposit" ? "Deposit" : "Balance"} of ${formatNaira(payment.amountKobo)} received (${payment.paystackReference})${status === "needs_attention" ? ". Paid after the time was taken: the booking needs a new time" : status === "confirmed" && booking.status !== "confirmed" ? ". Booking confirmed" : ""}`,
  });
  return { duplicate: false, status };
}

/** Confirmation and reminder rows, created with the confirmation. Sending happens later (scheduler). */
export async function createBookingNotifications(tx: Tx, bookingId: string): Promise<void> {
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const emailUsable = booking.contactEmail !== null;
  const channel = emailUsable ? "email" : "whatsapp_manual";
  const now = new Date();
  const rows = [
    { dedupeKey: `confirmation:${booking.id}`, type: "confirmation" as const, dueAt: now },
    { dedupeKey: `reminder:${booking.id}`, type: "reminder" as const, dueAt: new Date(booking.startAt.getTime() - DAY_MS) },
  ];
  for (const r of rows) {
    await tx.notification.upsert({
      where: { dedupeKey: r.dedupeKey },
      create: { ...r, bookingId: booking.id, customerId: booking.customerId, channel },
      update: {},
    });
  }
}

/* ───────────────────────────── Admin actions ───────────────────────────── */

export interface Actor {
  id: string | null;
  label: string;
}

async function getBooking(tx: Tx, id: string) {
  const b = await tx.booking.findUnique({ where: { id } });
  if (!b) throw new BookingError("NOT_FOUND", "Booking not found.");
  return b;
}

const STATUS_CHANGES: Record<"cancelled" | "no_show" | "confirmed", BookingStatus[]> = {
  cancelled: ["pending_payment", "confirmed", "needs_attention"],
  no_show: ["confirmed"],
  confirmed: ["cancelled", "no_show"],
};

export async function setBookingStatus(bookingId: string, status: "cancelled" | "no_show" | "confirmed", actor: Actor) {
  return db.$transaction(async (tx) => {
    const b = await getBooking(tx, bookingId);
    if (!STATUS_CHANGES[status].includes(b.status)) {
      throw new BookingError("NOT_ALLOWED", `A ${b.status.replace(/_/g, " ")} booking can't be changed to ${status.replace(/_/g, " ")}.`);
    }
    if (status === "confirmed") {
      // Reinstating uses the same capacity check as a new booking, under the same lock.
      await lockSalonDay(tx, lagosDateKey(b.startAt));
      const settings = await loadSettings(tx);
      if (!(await timeStillFree(tx, settings, b, Date.now()))) {
        throw new BookingError("SLOT_TAKEN", "This time is now full, so the booking can't be reinstated. Move it to another time instead.");
      }
      const paid = await tx.payment.count({ where: { bookingId, status: "success", amountKobo: { gt: 0 } } });
      if (!paid) throw new BookingError("NOT_ALLOWED", "This booking has no payment recorded, so it can't be reinstated as confirmed.");
    }
    await tx.booking.update({
      where: { id: bookingId },
      data: { status, holdExpiresAt: null, cancelledAt: status === "cancelled" ? new Date() : status === "confirmed" ? null : undefined },
    });
    await audit(tx, {
      action: `booking.${status === "confirmed" ? "reinstated" : status}`,
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "Booking",
      entityId: b.id,
      bookingId: b.id,
      customerId: b.customerId,
      summary: `Status changed from ${b.status.replace(/_/g, " ")} to ${status.replace(/_/g, " ")}`,
    });
  });
}

export interface CompletionInput {
  extras: { name: string; priceKobo: Kobo; note: string }[];
}

/** Marks the appointment completed, adding anything done on the day. The total follows the items. */
export async function completeBooking(bookingId: string, input: CompletionInput, actor: Actor) {
  return db.$transaction(async (tx) => {
    const b = await getBooking(tx, bookingId);
    if (b.status !== "confirmed" && b.status !== "completed") {
      throw new BookingError("NOT_ALLOWED", "Only confirmed or completed bookings can be completed.");
    }
    const extras = input.extras.filter((e) => e.name.trim());
    for (const e of extras) {
      if (!Number.isInteger(e.priceKobo) || e.priceKobo < 0) throw new BookingError("VALIDATION", `Enter a valid price for “${e.name}”.`);
    }
    if (extras.length) {
      await tx.bookingItem.createMany({
        data: extras.map((e) => ({ bookingId, kind: "extra" as const, name: e.name.trim().slice(0, 80), priceKobo: e.priceKobo, durationMinutes: 0, note: e.note.trim().slice(0, 300) })),
      });
    }
    const items = await tx.bookingItem.findMany({ where: { bookingId } });
    const totalKobo = itemsTotal(items);
    await tx.booking.update({ where: { id: bookingId }, data: { status: "completed", completedAt: b.completedAt ?? new Date(), totalKobo } });
    const payments = await tx.payment.findMany({ where: { bookingId } });
    const due = balanceDue({ totalKobo }, payments);
    await audit(tx, {
      action: b.status === "completed" ? "booking.completion_updated" : "booking.completed",
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "Booking",
      entityId: b.id,
      bookingId: b.id,
      customerId: b.customerId,
      summary: `${extras.length ? `Added ${extras.map((e) => `${e.name} (${formatNaira(e.priceKobo)})`).join(", ")}. ` : ""}Total ${formatNaira(totalKobo)}; balance ${formatNaira(due)}`,
    });
    return { balanceDueKobo: due };
  });
}

export async function updateBookingNote(bookingId: string, privateNote: string, actor: Actor) {
  return db.$transaction(async (tx) => {
    const b = await getBooking(tx, bookingId);
    await tx.booking.update({ where: { id: bookingId }, data: { privateNote: privateNote.trim().slice(0, 2000) } });
    await audit(tx, { action: "booking.private_note", actorLabel: actor.label, actorId: actor.id, entityType: "Booking", entityId: b.id, bookingId: b.id, customerId: b.customerId, summary: "Private booking note updated" });
  });
}

export async function updateCustomerNote(customerId: string, notes: string, actor: Actor) {
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findUnique({ where: { id: customerId } });
    if (!c) throw new BookingError("NOT_FOUND", "Customer not found.");
    await tx.customer.update({ where: { id: customerId }, data: { notes: notes.trim().slice(0, 4000) } });
    await audit(tx, { action: "customer.private_note", actorLabel: actor.label, actorId: actor.id, entityType: "Customer", entityId: c.id, customerId: c.id, summary: "Private customer note updated" });
  });
}

const MANUAL_PAYMENT_STATUSES: BookingStatus[] = ["pending_payment", "confirmed", "completed", "needs_attention", "no_show"];

/**
 * Cash, transfer to the salon's own account, or other. Appended to the ledger as `manual`.
 * A manual deposit on an unpaid booking confirms it, with the same capacity check as online payment.
 */
export async function recordManualPayment(bookingId: string, input: { amountKobo: Kobo; method: PaymentMethod; note: string; towardsDeposit: boolean }, actor: Actor) {
  if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) throw new BookingError("VALIDATION", "Enter an amount above ₦0.");
  return db.$transaction(async (tx) => {
    const b = await getBooking(tx, bookingId);
    if (!MANUAL_PAYMENT_STATUSES.includes(b.status)) {
      throw new BookingError("NOT_ALLOWED", `Payments can't be recorded on a ${b.status.replace(/_/g, " ")} booking.`);
    }
    if (input.towardsDeposit && b.status !== "pending_payment") {
      throw new BookingError("NOT_ALLOWED", "The deposit for this booking is already settled. Record it as a balance payment.");
    }
    await tx.payment.create({
      data: { bookingId, type: "manual", method: input.method, amountKobo: input.amountKobo, recordedById: actor.id, note: input.note.trim().slice(0, 500) },
    });
    let confirmed = false;
    if (input.towardsDeposit) {
      await lockSalonDay(tx, lagosDateKey(b.startAt));
      const settings = await loadSettings(tx);
      const holdLive = b.holdExpiresAt !== null && b.holdExpiresAt.getTime() > Date.now();
      const status = holdLive || (await timeStillFree(tx, settings, b, Date.now())) ? "confirmed" : "needs_attention";
      await tx.booking.update({ where: { id: bookingId }, data: { status, holdExpiresAt: null } });
      if (status === "confirmed") {
        confirmed = true;
        await createBookingNotifications(tx, bookingId);
      }
    }
    await audit(tx, {
      action: "payment.manual.recorded",
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "Booking",
      entityId: b.id,
      bookingId: b.id,
      customerId: b.customerId,
      summary: `Manual ${input.method} payment of ${formatNaira(input.amountKobo)} recorded${confirmed ? "; booking confirmed" : ""}`,
    });
  });
}

/* ───────────────────────────── Settings and services ───────────────────────────── */

export interface ServiceInput {
  id: string | null;
  name: string;
  description: string;
  priceKobo: Kobo;
  durationMinutes: number;
  active: boolean;
}

export async function upsertService(input: ServiceInput, actor: Actor) {
  return db.$transaction(async (tx) => {
    const data = { name: input.name, description: input.description, priceKobo: input.priceKobo, durationMinutes: input.durationMinutes, active: input.active };
    const existing = input.id ? await tx.service.findUnique({ where: { id: input.id } }) : null;
    const saved = existing
      ? await tx.service.update({ where: { id: existing.id }, data })
      : await tx.service.create({ data: { ...data, sortOrder: ((await tx.service.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1 } });
    await audit(tx, {
      action: existing ? "service.updated" : "service.created",
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "Service",
      entityId: saved.id,
      summary: existing ? `Service “${saved.name}” updated (existing bookings keep their prices)` : `Service “${saved.name}” added`,
    });
  });
}

export async function updateSettings(patch: Partial<Pick<Settings, "availability" | "deposit">>, actor: Actor) {
  return db.$transaction(async (tx) => {
    const a = patch.availability;
    const d = patch.deposit;
    await tx.settings.update({
      where: { id: 1 },
      data: {
        ...(a && {
          weeklyHours: a.weeklyHours,
          capacityByWeekday: a.capacityByWeekday,
          slotIntervalMinutes: a.slotIntervalMinutes,
          bufferMinutes: a.bufferMinutes,
          holdMinutes: a.holdMinutes,
          minimumLeadMinutes: a.minimumLeadMinutes,
          bookingHorizonDays: a.bookingHorizonDays,
        }),
        ...(d && { depositType: d.type, depositFixedKobo: d.fixedKobo, depositPercent: d.percent, depositScope: d.scope, depositMinimumKobo: d.minimumKobo }),
      },
    });
    await audit(tx, { action: "settings.updated", actorLabel: actor.label, actorId: actor.id, entityType: "Settings", entityId: "1", summary: `Updated ${Object.keys(patch).join(" and ")} settings` });
  });
}

/* ───────────────────────────── Customer access ───────────────────────────── */

/** Booking for the customer's own page. Requires the link token; expired links stop working. */
export async function findBookingByToken(reference: string, token: string | undefined) {
  if (!token) return null;
  const booking = await db.booking.findUnique({ where: { reference }, include: { items: true } });
  if (!booking || booking.accessTokenHash !== (await sha256Hex(token)) || booking.accessExpiresAt.getTime() < Date.now()) return null;
  return toBooking(booking);
}
