import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings } from "../factories";
import { lagosToUtcMs } from "@/lib/time";
import { createPendingBooking } from "@/server/booking-service";
import { createExpense, softDeleteExpense } from "@/server/expenses";
import { dailyTotals, dayDetail } from "@/server/finances";

const actor = { id: null, label: "Test admin" };
let bookingId: string;
let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  await createSettings();
  await createServices();
  const r = await createPendingBooking(bookingInput());
  bookingId = (await db.booking.findUniqueOrThrow({ where: { reference: r.reference } })).id;
  categoryId = (await db.expenseCategory.create({ data: { name: "Supplies" } })).id;
});

/** A ledger row at a given Lagos date and time (test set-up: the ledger is what's under test). */
async function payment(dateKey: string, hhmm: string, amountKobo: number, extra: { status?: "success" | "failed"; type?: "manual" | "adjustment"; customerFeeKobo?: number } = {}) {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  await db.payment.create({
    data: { bookingId, type: extra.type ?? "manual", method: "cash", amountKobo, status: extra.status ?? "success", customerFeeKobo: extra.customerFeeKobo ?? 0, createdAt: new Date(lagosToUtcMs(dateKey, h * 60 + m)) },
  });
}

describe("daily finance table", () => {
  it("has a row for every day, zeros included, and totals that equal the ledger and the expenses", async () => {
    await payment("2026-11-02", "10:00", 500_000);
    await payment("2026-11-02", "15:00", 250_000, { customerFeeKobo: 3_046 });
    await payment("2026-11-04", "09:00", 1_000_000);
    await payment("2026-11-04", "11:00", 999_999, { status: "failed" });
    await createExpense({ dateKey: "2026-11-03", amountKobo: 120_000, categoryId, method: "cash", note: "" }, actor, Date.parse("2026-11-20T12:00:00Z"));

    const t = await dailyTotals("2026-11-01", "2026-11-05");
    expect(t.days.map((d) => [d.dateKey, d.revenueKobo, d.expensesKobo, d.netKobo])).toEqual([
      ["2026-11-01", 0, 0, 0],
      ["2026-11-02", 750_000, 0, 750_000],
      ["2026-11-03", 0, 120_000, -120_000],
      ["2026-11-04", 1_000_000, 0, 1_000_000],
      ["2026-11-05", 0, 0, 0],
    ]);
    const ledger = await db.payment.aggregate({ where: { status: "success" }, _sum: { amountKobo: true } });
    expect(t.revenueKobo).toBe(ledger._sum.amountKobo);
    expect(t).toMatchObject({ expensesKobo: 120_000, netKobo: 1_750_000 - 120_000 });
  });

  it("puts a late-evening payment on its Lagos date, not the UTC one", async () => {
    // 23:30 in Lagos is 22:30 UTC the same day; 00:30 Lagos is still the previous UTC day.
    await payment("2026-11-10", "23:30", 100_000);
    await payment("2026-11-11", "00:30", 200_000);
    const t = await dailyTotals("2026-11-10", "2026-11-11");
    expect(t.days.map((d) => d.revenueKobo)).toEqual([100_000, 200_000]);
    expect((await dailyTotals("2026-11-11", "2026-11-11")).revenueKobo).toBe(200_000);
  });

  it("counts corrections, and leaves out deleted expenses and money outside the period", async () => {
    await payment("2026-11-02", "10:00", 500_000);
    await payment("2026-11-02", "12:00", -100_000, { type: "adjustment" });
    await payment("2026-10-31", "23:59", 777_700);
    const gone = await createExpense({ dateKey: "2026-11-02", amountKobo: 50_000, categoryId, method: "cash", note: "" }, actor, Date.parse("2026-11-20T12:00:00Z"));
    await softDeleteExpense(gone, actor);
    const t = await dailyTotals("2026-11-01", "2026-11-30");
    expect(t.days).toHaveLength(30);
    expect(t).toMatchObject({ revenueKobo: 400_000, expensesKobo: 0, netKobo: 400_000 });
  });

  it("shows what's behind one day: its payments with their booking, and its expenses", async () => {
    await payment("2026-11-02", "10:00", 500_000);
    await payment("2026-11-02", "11:00", 999_999, { status: "failed" });
    await payment("2026-11-03", "10:00", 1);
    await createExpense({ dateKey: "2026-11-02", amountKobo: 120_000, categoryId, method: "transfer", note: "Gel" }, actor, Date.parse("2026-11-20T12:00:00Z"));
    const d = await dayDetail("2026-11-02");
    expect(d.payments).toHaveLength(1);
    expect(d.payments[0]).toMatchObject({ amountKobo: 500_000, bookingId, customerName: "Ada Okafor" });
    expect(d.expenses.map((e) => [e.amountKobo, e.note])).toEqual([[120_000, "Gel"]]);
    expect(d.totals).toMatchObject({ revenueKobo: 500_000, expensesKobo: 120_000, netKobo: 380_000 });
  });
});
