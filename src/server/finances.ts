import "server-only";
import type { Kobo, PaymentMethod, PaymentType } from "@/domain/types";
import { addDays, lagosToUtcMs } from "@/lib/time";
import { db } from "./db";
import { listExpenses, type ExpenseRow } from "./expenses";

/**
 * Finances (BUILD_SPEC 6.6). Revenue is money in, only ever from the Payment ledger, so
 * corrections count and a transaction fee the customer paid on top never does. Expenses are
 * money out, leaving deleted ones aside. Days are Lagos calendar days.
 */

export interface DayTotals {
  dateKey: string;
  revenueKobo: Kobo;
  expensesKobo: Kobo;
  netKobo: Kobo;
}

export interface PeriodTotals {
  days: DayTotals[];
  revenueKobo: Kobo;
  expensesKobo: Kobo;
  netKobo: Kobo;
}

/**
 * One row per day from `fromKey` to `toKey` (inclusive), zeros included: generate_series makes
 * the days and the money is joined on. Payments are grouped by their Lagos date.
 */
export async function dailyTotals(fromKey: string, toKey: string): Promise<PeriodTotals> {
  const fromUtc = new Date(lagosToUtcMs(fromKey, 0));
  const toUtc = new Date(lagosToUtcMs(addDays(toKey, 1), 0));
  const rows = await db.$queryRaw<{ day: string; revenue: bigint; expenses: bigint }[]>`
    WITH days AS (
      SELECT d::date AS day FROM generate_series(${fromKey}::date, ${toKey}::date, interval '1 day') AS d
    ),
    revenue AS (
      SELECT (p.created_at AT TIME ZONE 'Africa/Lagos')::date AS day, SUM(p.amount_kobo)::bigint AS kobo
      FROM payments p
      WHERE p.status = 'success' AND p.created_at >= ${fromUtc} AND p.created_at < ${toUtc}
      GROUP BY 1
    ),
    spent AS (
      SELECT e.date AS day, SUM(e.amount_kobo)::bigint AS kobo
      FROM expenses e
      WHERE e.deleted_at IS NULL AND e.date BETWEEN ${fromKey}::date AND ${toKey}::date
      GROUP BY 1
    )
    SELECT to_char(days.day, 'YYYY-MM-DD') AS day, COALESCE(revenue.kobo, 0)::bigint AS revenue, COALESCE(spent.kobo, 0)::bigint AS expenses
    FROM days
    LEFT JOIN revenue ON revenue.day = days.day
    LEFT JOIN spent ON spent.day = days.day
    ORDER BY days.day
  `;
  const days = rows.map((r) => {
    const revenueKobo = Number(r.revenue);
    const expensesKobo = Number(r.expenses);
    return { dateKey: r.day, revenueKobo, expensesKobo, netKobo: revenueKobo - expensesKobo };
  });
  const revenueKobo = days.reduce((s, d) => s + d.revenueKobo, 0);
  const expensesKobo = days.reduce((s, d) => s + d.expensesKobo, 0);
  return { days, revenueKobo, expensesKobo, netKobo: revenueKobo - expensesKobo };
}

export interface DayPayment {
  id: string;
  at: string;
  amountKobo: Kobo;
  type: PaymentType;
  method: PaymentMethod;
  note: string;
  bookingId: string;
  bookingReference: string;
  customerName: string;
  recordedByName: string | null;
}

/** Everything behind one day's row: the payments received and the expenses paid. */
export async function dayDetail(dateKey: string): Promise<{ payments: DayPayment[]; expenses: ExpenseRow[]; totals: DayTotals }> {
  const from = new Date(lagosToUtcMs(dateKey, 0));
  const to = new Date(lagosToUtcMs(addDays(dateKey, 1), 0));
  const [payments, { rows: expenses }] = await Promise.all([
    db.payment.findMany({
      where: { status: "success", createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: "asc" },
      include: { booking: { select: { id: true, reference: true, contactName: true } }, recordedBy: { select: { displayName: true } } },
    }),
    listExpenses({ fromKey: dateKey, toKey: dateKey }),
  ]);
  const revenueKobo = payments.reduce((s, p) => s + p.amountKobo, 0);
  const expensesKobo = expenses.reduce((s, e) => s + e.amountKobo, 0);
  return {
    payments: payments.map((p) => ({
      id: p.id,
      at: p.createdAt.toISOString(),
      amountKobo: p.amountKobo,
      type: p.type,
      method: p.method,
      note: p.note,
      bookingId: p.booking.id,
      bookingReference: p.booking.reference,
      customerName: p.booking.contactName,
      recordedByName: p.recordedBy?.displayName ?? null,
    })),
    expenses,
    totals: { dateKey, revenueKobo, expensesKobo, netKobo: revenueKobo - expensesKobo },
  };
}
