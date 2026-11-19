import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "../db";

beforeEach(resetDatabase);

async function makeBooking(reference: string) {
  const customer = await db.customer.create({ data: { displayName: "Test Customer" } });
  const start = new Date("2026-12-01T09:00:00Z");
  return db.booking.create({
    data: {
      reference,
      accessTokenHash: `hash-${reference}`,
      accessExpiresAt: new Date("2027-01-01T00:00:00Z"),
      customerId: customer.id,
      contactName: "Test Customer",
      contactPhone: "+2348031234567",
      startAt: start,
      endAt: new Date(start.getTime() + 60 * 60_000),
      totalKobo: 1_000_000,
      depositDueKobo: 300_000,
    },
  });
}

describe("row-level security", () => {
  it("is enabled on every table", async () => {
    const rows = await db.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = current_schema()`;
    expect(rows.length).toBeGreaterThan(15);
    expect(rows.filter((r) => !r.rowsecurity).map((r) => r.tablename)).toEqual([]);
  });
});

describe("uniqueness rules that protect data integrity", () => {
  it("a phone number belongs to one customer only", async () => {
    const a = await db.customer.create({ data: { displayName: "A" } });
    const b = await db.customer.create({ data: { displayName: "B" } });
    await db.customerPhone.create({ data: { customerId: a.id, e164: "+2348031234567" } });
    await expect(db.customerPhone.create({ data: { customerId: b.id, e164: "+2348031234567" } })).rejects.toThrow();
  });

  it("an email belongs to one customer only", async () => {
    const a = await db.customer.create({ data: { displayName: "A" } });
    const b = await db.customer.create({ data: { displayName: "B" } });
    await db.customerEmail.create({ data: { customerId: a.id, value: "ada@example.com" } });
    await expect(db.customerEmail.create({ data: { customerId: b.id, value: "ada@example.com" } })).rejects.toThrow();
  });

  it("the same Paystack reference can never be recorded twice", async () => {
    const booking = await makeBooking("HC-TEST1");
    const row = { bookingId: booking.id, type: "deposit" as const, method: "card" as const, amountKobo: 300_000, paystackReference: "ref_1" };
    await db.payment.create({ data: row });
    await expect(db.payment.create({ data: row })).rejects.toThrow();
  });

  it("manual payments without a Paystack reference can coexist", async () => {
    const booking = await makeBooking("HC-TEST2");
    const row = { bookingId: booking.id, type: "manual" as const, method: "cash" as const, amountKobo: 100_000 };
    await db.payment.create({ data: row });
    await db.payment.create({ data: row });
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(2);
  });

  it("a notification dedupe key is used once", async () => {
    const row = { dedupeKey: "summary:2026-12-01", type: "owner_daily_summary" as const, channel: "email" as const, dueAt: new Date() };
    await db.notification.create({ data: row });
    await expect(db.notification.create({ data: row })).rejects.toThrow();
  });

  it("a customer with bookings cannot be deleted by accident", async () => {
    const booking = await makeBooking("HC-TEST3");
    await expect(db.customer.delete({ where: { id: booking.customerId } })).rejects.toThrow();
  });
});

describe("stored times", () => {
  it("stores and reads back the exact instant, whatever the database's own timezone", async () => {
    const at = new Date("2026-11-23T08:30:00.000Z"); // 9:30 am in Lagos
    await db.block.create({ data: { id: "tz_check", startAt: at, endAt: at } });
    const [row] = await db.$queryRaw<{ epoch: number }[]>`SELECT extract(epoch FROM "startAt")::float8 AS epoch FROM "Block" WHERE id = 'tz_check'`;
    expect(row.epoch * 1000).toBe(at.getTime());
    expect((await db.block.findUniqueOrThrow({ where: { id: "tz_check" } })).startAt.toISOString()).toBe(at.toISOString());
  });
});
