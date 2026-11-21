import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings, slot } from "../factories";
import { visitInfo } from "@/domain/crm";
import { balanceDue, paidKobo, paymentSummaryState } from "@/domain/pricing";
import { addDays, lagosDateKey, lagosToUtcMs } from "@/lib/time";
import type { BookingFilters } from "@/server/admin-queries";

vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));

const { createPendingBooking, recordManualPayment } = await import("@/server/booking-service");
const q = await import("@/server/admin-queries");
const { toBooking, toPayment } = await import("@/server/mappers");

const actor = { id: null, label: "Test admin" };
const DAY = 86_400_000;

beforeEach(async () => {
  await resetDatabase();
  await createSettings({ capacity: 10 });
  await createServices();
});

type Made = Awaited<ReturnType<typeof db.booking.findUniqueOrThrow>>;

/** A booking through the real service, then moved or settled the way the scenario needs. */
async function make(o: { name?: string; phone?: string; email?: string; daysAhead?: number; at?: string; status?: "confirmed" | "completed" | "cancelled" | "no_show" | "pending"; paid?: number[]; addOn?: boolean } = {}): Promise<Made> {
  const r = await createPendingBooking(
    bookingInput({ ...(o.name ? { name: o.name } : {}), ...(o.phone ? { phone: o.phone } : {}), ...(o.email ? { email: o.email } : {}), startAt: slot(1, "10:00"), addOnIds: o.addOn ? ["svc_wash"] : [] }),
  );
  let b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
  if (o.status !== "pending") {
    await recordManualPayment(b.id, { amountKobo: b.depositDueKobo, method: "cash", note: "", purpose: "deposit" }, actor);
    for (const amount of o.paid ?? []) {
      await recordManualPayment(b.id, { amountKobo: amount, method: "transfer", note: amount < 0 ? "Typed twice" : "", purpose: amount < 0 ? "correction" : "balance" }, actor);
    }
  }
  const startAt = o.at ? new Date(o.at) : new Date(Date.now() + (o.daysAhead ?? 1) * DAY);
  const length = b.endAt.getTime() - b.startAt.getTime();
  const status = o.status === "pending" ? "pending_payment" : (o.status ?? "confirmed");
  b = await db.booking.update({ where: { id: b.id }, data: { startAt, endAt: new Date(startAt.getTime() + length), status } });
  return b;
}

/** What the admin pages computed before: everything loaded, then filtered in memory. */
async function everything() {
  const rows = await db.booking.findMany({ include: { items: true, customer: { include: { phones: true, emails: true } } }, orderBy: { startAt: "asc" } });
  const payments = (await db.payment.findMany({ orderBy: { createdAt: "asc" } })).map(toPayment);
  const bookings = rows.map(toBooking);
  return bookings.map((b, i) => ({
    booking: b,
    customer: rows[i]!.customer,
    payments: payments.filter((p) => p.bookingId === b.id),
    visit: visitInfo(b, bookings.filter((x) => x.customerId === b.customerId)),
  }));
}

describe("booking detail", () => {
  it("returns the booking with its customer, payments and visit", async () => {
    const first = await make({ name: "Kemi", phone: "08035550101", daysAhead: -20, status: "completed", paid: [1_000_000] });
    const second = await make({ name: "Kemi", phone: "08035550101", daysAhead: 2 });
    const row = await q.getAdminBooking(second.id);
    expect(row!.customer.id).toBe(first.customerId);
    expect(row!.visit).toEqual({ returning: true, visitNumber: 2 });
    expect(row!.payments).toHaveLength(1);
    expect(await q.getAdminBooking("nope")).toBeNull();
  });

  it("keeps a booking's whole history, even with lots of newer activity elsewhere", async () => {
    const b = await make();
    await db.auditLog.createMany({ data: Array.from({ length: 520 }, (_, i) => ({ actorLabel: "System", action: "x", entityType: "other", summary: `noise ${i}` })) });
    const audit = await q.bookingAudit(b.id);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.every((e) => e.bookingId === b.id)).toBe(true);
    expect([...audit].sort((x, y) => y.at.localeCompare(x.at))).toEqual(audit);
  });
});

describe("bookings list", () => {
  async function scenario() {
    await make({ name: "Kemi Bello", phone: "08035550101", email: "kemi@example.com", daysAhead: -30, status: "completed", paid: [1_050_000] });
    await make({ name: "Kemi Bello", phone: "08035550101", email: "kemi@example.com", daysAhead: -10, status: "completed" });
    await make({ name: "Tunde Ade", phone: "08035550202", daysAhead: -5, status: "no_show" });
    await make({ name: "Tunde Ade", phone: "08035550202", daysAhead: -3, status: "completed", paid: [500_000, -200_000] });
    await make({ name: "Bisi Cole", phone: "08035550303", daysAhead: 2, addOn: true });
    await make({ name: "Bisi Cole", phone: "08035550303", daysAhead: 4, status: "cancelled" });
    await make({ name: "Ngozi Eze", phone: "08035550404", daysAhead: 6, status: "pending" });
  }

  const ref = async (f: BookingFilters) => {
    const s = (f.q ?? "").trim().toLowerCase();
    return (await everything())
      .filter(({ booking, customer, payments }) => {
        if (f.status && booking.status !== f.status) return false;
        if (f.payment && paymentSummaryState(booking, payments) !== f.payment) return false;
        const day = lagosDateKey(booking.startAt);
        if (f.from && day < f.from) return false;
        if (f.to && day > f.to) return false;
        if (s) {
          const hay = [booking.reference, customer.displayName, booking.contactName, ...customer.phones.map((p) => p.e164), ...customer.emails.map((e) => e.value), ...booking.items.map((l) => l.name)].join(" ").toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => b.booking.startAt.localeCompare(a.booking.startAt));
  };

  it("matches the old in-memory filters, totals and order", async () => {
    await scenario();
    const today = lagosDateKey(Date.now());
    const cases: BookingFilters[] = [
      {},
      { status: "completed" },
      { payment: "balance_due" },
      { payment: "paid_in_full" },
      { payment: "unpaid" },
      { q: "kemi" },
      { q: "+234803555020" },
      { q: "KEMI@EXAMPLE" },
      { q: "wash" },
      { from: addDays(today, -11), to: addDays(today, 3) },
      { status: "completed", q: "tunde" },
    ];
    for (const f of cases) {
      const expected = await ref(f);
      const got = await q.listAdminBookings(f, undefined, 100);
      expect(got.items.map((r) => r.booking.id), JSON.stringify(f)).toEqual(expected.map((r) => r.booking.id));
      expect(got.totalPaidKobo).toBe(expected.reduce((s, r) => s + paidKobo(r.payments), 0));
      expect(got.totalBalanceKobo).toBe(expected.filter((r) => r.booking.status === "completed").reduce((s, r) => s + balanceDue(r.booking, r.payments), 0));
      expect(got.items.map((r) => r.visit)).toEqual(expected.map((r) => r.visit));
    }
    expect((await q.listAdminBookings({}, undefined, 100)).allCount).toBe(7);
  });

  it("finds a phone typed the local way, and ignores a made-up status", async () => {
    await scenario();
    expect((await q.listAdminBookings({ q: "0803 555 0303" }, undefined, 10)).total).toBe(2);
    expect((await q.listAdminBookings({ status: "bogus" }, undefined, 10)).total).toBe(0);
  });

  it("counts totals over every match and pages the rows", async () => {
    await scenario();
    const page1 = await q.listAdminBookings({}, undefined, 3);
    const page3 = await q.listAdminBookings({}, "3", 3);
    expect(page1.items).toHaveLength(3);
    expect(page3.items).toHaveLength(1);
    expect(page3.totalPaidKobo).toBe(page1.totalPaidKobo);
    expect(page3.items[0]!.booking.id).toBe((await ref({})).at(-1)!.booking.id);
  });

  it("puts 23:30 Lagos on that Lagos day, not the UTC one", async () => {
    const key = addDays(lagosDateKey(Date.now()), 2);
    const late = await make({ at: new Date(lagosToUtcMs(key, 23 * 60 + 30)).toISOString() });
    expect((await q.listAdminBookings({ from: key, to: key }, undefined, 10)).items.map((r) => r.booking.id)).toEqual([late.id]);
    expect((await q.listAdminBookings({ from: addDays(key, 1) }, undefined, 10)).total).toBe(0);
  });
});

describe("dashboard", () => {
  it("lists balances the same way as balanceDue, including corrections and overpayment", async () => {
    const owes = await make({ daysAhead: -4, status: "completed" });
    const corrected = await make({ daysAhead: -3, status: "completed", paid: [1_050_000, -100_000] });
    await make({ daysAhead: -2, status: "completed", paid: [1_050_000] });
    await make({ daysAhead: -1, status: "completed", paid: [2_000_000] });
    await make({ daysAhead: 2 });
    const expected = (await everything()).filter((r) => r.booking.status === "completed" && balanceDue(r.booking, r.payments) > 0).map((r) => r.booking.id);
    expect(expected).toEqual([owes.id, corrected.id]);
    expect((await q.unpaidCompletedIds()).sort()).toEqual([...expected].sort());
  });

  it("counts today, the next 7 days and times on hold", async () => {
    const nowMs = Date.now();
    const today = lagosDateKey(nowMs);
    const later = await make({ at: new Date(nowMs + 60_000).toISOString() });
    await make({ daysAhead: 3 });
    await make({ daysAhead: 9 });
    await make({ daysAhead: 2, status: "pending" });
    await make({ daysAhead: 1, status: "cancelled" });
    const d = await q.getDashboard(nowMs, today);
    expect(d.upcomingCount).toBe(2);
    expect(d.awaitingCount).toBe(1);
    expect(d.nextUp.map((r) => r.booking.status)).toEqual(["confirmed", "confirmed", "confirmed"]);
    expect(d.nextUp[0]!.booking.id).toBe(later.id);
    expect(d.todays.map((r) => r.booking.id)).toEqual(lagosDateKey(later.startAt) === today ? [later.id] : []);
  });

  it("gives this month's appointments with new or returning", async () => {
    const nowMs = Date.now();
    const today = lagosDateKey(nowMs);
    const earlier = await make({ phone: "08035550909", daysAhead: -60, status: "completed" });
    const visit = await make({ phone: "08035550909", at: new Date(lagosToUtcMs(today, 12 * 60)).toISOString() });
    const d = await q.getDashboard(nowMs, today);
    const mine = d.month.filter((m) => m.customerId === earlier.customerId);
    expect(mine).toEqual([{ customerId: visit.customerId, mainServices: ["Retwist"], visit: { returning: true, visitNumber: 2 } }]);
  });
});

describe("customers", () => {
  it("orders by latest visit, searches by local phone and pages", async () => {
    const a = await make({ name: "Amaka", phone: "08035550111", daysAhead: -20, status: "completed" });
    const b = await make({ name: "Bola", phone: "08035550222", daysAhead: 5 });
    const c = await make({ name: "Chidi", phone: "08035550333", daysAhead: -2, status: "completed", paid: [1_050_000] });
    const list = await q.listAdminCustomers("", undefined, 20);
    expect(list.items.map((r) => r.customer.id)).toEqual([b.customerId, c.customerId, a.customerId]);
    const amaka = list.items.find((r) => r.customer.id === a.customerId)!;
    expect(amaka.bookingCount).toBe(1);
    expect(amaka.outstandingKobo).toBe(a.totalKobo - a.depositDueKobo);
    expect(list.items.find((r) => r.customer.id === c.customerId)!.outstandingKobo).toBe(0);
    expect((await q.listAdminCustomers("0803 555 0222", undefined, 20)).items.map((r) => r.customer.id)).toEqual([b.customerId]);
    expect((await q.listAdminCustomers("chi", undefined, 20)).items.map((r) => r.customer.id)).toEqual([c.customerId]);
    const p2 = await q.listAdminCustomers("", "2", 2);
    expect(p2.items.map((r) => r.customer.id)).toEqual([a.customerId]);
    expect(p2.total).toBe(3);
  });

  it("loads one customer's bookings and payments for the profile", async () => {
    const first = await make({ phone: "08035550444", daysAhead: -9, status: "completed", paid: [1_050_000] });
    await make({ phone: "08035550444", daysAhead: 3 });
    await make({ phone: "08035550555", daysAhead: 3 });
    const p = await q.getCustomerProfile(first.customerId);
    expect(p!.bookings).toHaveLength(2);
    expect(p!.payments).toHaveLength(3);
    expect(p!.payments.map((x) => x.createdAt)).toEqual([...p!.payments.map((x) => x.createdAt)].sort());
    expect(await q.getCustomerProfile("nope")).toBeNull();
  });
});
