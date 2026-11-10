/**
 * Seed data for the prototype. Every customer, booking and payment here is a
 * DEMO RECORD with obviously fake contact details. Dates are generated
 * relative to "now" so the dashboard always has something to show.
 */
import type { AuditEvent, Booking, BookingServiceLine, Customer, Database, Payment, Service } from "@/domain/types";
import { DEMO_SERVICES, DEMO_SETTINGS } from "./demo-config";
import { depositFor, estimateServices } from "@/domain/pricing";
import { addDays, dayOfWeek, lagosDateKey, lagosToUtcMs } from "@/lib/time";

export const DB_VERSION = 1;

function nextOpenDate(fromKey: string, offset: number, direction: 1 | -1 = 1): string {
  let key = addDays(fromKey, offset);
  while (!DEMO_SETTINGS.availability.weeklyHours[dayOfWeek(key)]) key = addDays(key, direction);
  return key;
}

function line(service: Service, i: number): BookingServiceLine {
  return {
    id: `line_seed_${service.id}_${i}`,
    serviceId: service.id,
    kind: "booked",
    name: service.name,
    serviceStatus: service.status,
    estimatedPriceKobo: service.priceKobo,
    estimatedDurationMinutes: service.durationMinutes ?? DEMO_SETTINGS.availability.defaultDurationMinutes,
    delivered: false,
    actualPriceKobo: null,
    addOnNote: "",
  };
}

export function buildSeed(nowMs: number): Database {
  const now = new Date(nowMs).toISOString();
  const today = lagosDateKey(nowMs);
  const svc = Object.fromEntries(DEMO_SERVICES.map((s) => [s.id, s]));

  const customers: Customer[] = [
    { id: "cus_demo_1", name: "Adaeze Okafor", phone: "08000000001", email: null, createdAt: now, privateNotes: "Demo record. Prefers early morning appointments.", isDemo: true },
    { id: "cus_demo_2", name: "Tunde Bakare", phone: "08000000002", email: "tunde@example.test", createdAt: now, privateNotes: "Demo record.", isDemo: true },
    { id: "cus_demo_3", name: "Funmilayo Adeyemi", phone: null, email: "funmi@example.test", createdAt: now, privateNotes: "", isDemo: true },
    { id: "cus_demo_4", name: "Ibrahim Musa", phone: "08000000004", email: null, createdAt: now, privateNotes: "", isDemo: true },
  ];

  const bookings: Booking[] = [];
  const payments: Payment[] = [];
  const audit: AuditEvent[] = [];

  function addBooking(opts: {
    id: string;
    reference: string;
    customerId: string;
    dateKey: string;
    startMinutes: number;
    services: Service[];
    status: Booking["status"];
    holdMinutes?: number;
  }): Booking {
    const est = estimateServices(opts.services, DEMO_SETTINGS.availability.defaultDurationMinutes);
    const start = lagosToUtcMs(opts.dateKey, opts.startMinutes);
    const created = Math.min(nowMs, start) - 3 * 86_400_000;
    const b: Booking = {
      id: opts.id,
      reference: opts.reference,
      accessToken: `demo-token-${opts.id}`,
      customerId: opts.customerId,
      startAt: new Date(start).toISOString(),
      endAt: new Date(start + est.durationMinutes * 60_000).toISOString(),
      status: opts.status,
      createdAt: new Date(created).toISOString(),
      holdExpiresAt: opts.holdMinutes ? new Date(nowMs + opts.holdMinutes * 60_000).toISOString() : null,
      estimatedTotalKobo: est.totalKobo,
      hasUnpricedItems: est.hasUnpricedItems,
      depositDueKobo: depositFor(est.totalKobo, DEMO_SETTINGS.deposit),
      actualTotalKobo: null,
      lines: opts.services.map(line),
      customerNote: "",
      completionNote: "",
      privateNote: "",
      completedAt: null,
      isDemo: true,
    };
    bookings.push(b);
    audit.push({ id: `aud_${b.id}_created`, bookingId: b.id, customerId: b.customerId, action: "booking.created", actor: "Customer (demo)", at: b.createdAt, summary: `Booking ${b.reference} created online` });
    return b;
  }

  function pay(b: Booking, id: string, purpose: Payment["purpose"], amountKobo: number, at: number, state: Payment["state"] = "success"): void {
    payments.push({
      id,
      bookingId: b.id,
      customerId: b.customerId,
      amountKobo,
      purpose,
      state,
      source: "mock_checkout",
      reference: `MOCK-${id.toUpperCase()}`,
      createdAt: new Date(at).toISOString(),
      resolvedAt: new Date(at + 60_000).toISOString(),
      method: null,
      note: "",
      recordedBy: null,
      isDemo: true,
    });
    audit.push({ id: `aud_${id}`, bookingId: b.id, customerId: b.customerId, action: `payment.${purpose}.${state}`, actor: "Mock checkout", at: new Date(at + 60_000).toISOString(), summary: `Demo ${purpose} payment ${state === "success" ? "succeeded" : state}` });
  }

  // 1. Past booking — completed with an extra product, paid in full.
  const d1 = nextOpenDate(today, -9, -1);
  const b1 = addBooking({ id: "bkg_demo_1", reference: "HC-DEMO1", customerId: "cus_demo_1", dateKey: d1, startMinutes: 9 * 60, services: [svc.svc_retwist], status: "completed" });
  pay(b1, "pay_demo_1a", "deposit", b1.depositDueKobo, Date.parse(b1.createdAt));
  b1.lines[0] = { ...b1.lines[0], delivered: true, actualPriceKobo: 1_500_000 };
  b1.lines.push({ id: "line_seed_extra_1", serviceId: null, kind: "extra", name: "Loc oil (product)", serviceStatus: "demo", estimatedPriceKobo: null, estimatedDurationMinutes: 0, delivered: true, actualPriceKobo: 300_000, addOnNote: "Demo extra product" });
  b1.actualTotalKobo = 1_800_000;
  b1.completionNote = "Retwist done. Added a bottle of loc oil (demo product).";
  b1.completedAt = b1.endAt;
  pay(b1, "pay_demo_1b", "balance", 1_800_000 - b1.depositDueKobo, Date.parse(b1.endAt) + 3_600_000);

  // 2. Recent booking — completed, balance still due.
  const d2 = nextOpenDate(today, -1, -1);
  const b2 = addBooking({ id: "bkg_demo_2", reference: "HC-DEMO2", customerId: "cus_demo_2", dateKey: d2, startMinutes: 10 * 60, services: [svc.svc_starter_locs], status: "completed" });
  pay(b2, "pay_demo_2a", "deposit", b2.depositDueKobo, Date.parse(b2.createdAt));
  b2.lines[0] = { ...b2.lines[0], delivered: true, actualPriceKobo: 4_500_000 };
  b2.actualTotalKobo = 4_500_000;
  b2.completionNote = "Starter locs completed as booked.";
  b2.completedAt = b2.endAt;
  b2.privateNote = "Demo: customer asked to pay the balance online later today.";

  // 3. Upcoming — confirmed, two services.
  const d3 = nextOpenDate(today, 1);
  const b3 = addBooking({ id: "bkg_demo_3", reference: "HC-DEMO3", customerId: "cus_demo_3", dateKey: d3, startMinutes: 11 * 60, services: [svc.svc_consult, svc.svc_retwist], status: "confirmed" });
  pay(b3, "pay_demo_3a", "deposit", b3.depositDueKobo, Date.parse(b3.createdAt));
  b3.customerNote = "First time getting a retwist here.";

  // 4. Upcoming — awaiting deposit, with one failed attempt; hold still running.
  const d4 = nextOpenDate(today, 2);
  const b4 = addBooking({ id: "bkg_demo_4", reference: "HC-DEMO4", customerId: "cus_demo_4", dateKey: d4, startMinutes: 15 * 60, services: [svc.svc_custom], status: "awaiting_deposit", holdMinutes: 12 });
  b4.createdAt = new Date(nowMs - 3 * 60_000).toISOString();
  pay(b4, "pay_demo_4a", "deposit", b4.depositDueKobo, nowMs - 2 * 60_000, "failed");

  audit.sort((a, b) => a.at.localeCompare(b.at));

  return {
    version: DB_VERSION,
    seededAt: now,
    services: structuredClone(DEMO_SERVICES),
    customers,
    bookings,
    payments,
    audit,
    settings: structuredClone(DEMO_SETTINGS),
  };
}
