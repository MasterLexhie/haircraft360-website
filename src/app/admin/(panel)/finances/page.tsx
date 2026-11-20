import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Receipt } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { requestNow } from "@/server/queries";
import { dailyTotals } from "@/server/finances";
import { resolvePeriod } from "@/domain/periods";
import { formatNaira } from "@/lib/money";
import { formatDateKey, lagosDateKey } from "@/lib/time";
import { PageHeader } from "@/components/admin/bits";
import { PeriodPicker } from "@/components/admin/period-picker";
import { Skeleton, buttonClass, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Finances" };

type Search = { period?: string; from?: string; to?: string };

export default function FinancesPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Finances searchParams={searchParams} />
    </Suspense>
  );
}

async function Finances({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const [params, nowMs] = await Promise.all([searchParams, requestNow()]);
  const period = resolvePeriod(lagosDateKey(nowMs), params);
  const t = await dailyTotals(period.fromKey, period.toKey);

  return (
    <>
      <PageHeader
        title="Finances"
        description="Revenue is money received from customers. Expenses are money paid out. Net is what's left."
        actions={
          <Link href="/admin/finances/expenses" className={buttonClass("night", "md")}>
            <Receipt aria-hidden className="size-4" /> Expenses: add or view
          </Link>
        }
      />

      <PeriodPicker action="/admin/finances" period={period} />

      <h2 className="mb-3 text-sm font-semibold">{period.label}</h2>
      <dl className="mb-8 grid gap-3 sm:grid-cols-3">
        <Card label="Revenue" value={formatNaira(t.revenueKobo)} />
        <Card label="Expenses" value={formatNaira(t.expensesKobo)} />
        <Card label="Net" value={formatNaira(t.netKobo)} tone={t.netKobo < 0 ? "text-danger" : "text-success"} />
      </dl>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Money in and out by day</caption>
          <thead className="border-b border-line bg-sand/50 text-xs uppercase tracking-[0.08em] text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Date</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Revenue</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Expenses</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {t.days.map((d) => {
              const quiet = d.revenueKobo === 0 && d.expensesKobo === 0;
              return (
                <tr key={d.dateKey} className={cx("hover:bg-sand/40", quiet && "text-ink-3")}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/finances/day/${d.dateKey}`} className="font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                      {formatDateKey(d.dateKey)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{formatNaira(d.revenueKobo)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatNaira(d.expensesKobo)}</td>
                  <td className={cx("px-4 py-2.5 text-right tabular font-semibold", d.netKobo < 0 && "text-danger")}>{formatNaira(d.netKobo)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-line-strong bg-sand/40 font-semibold">
            <tr>
              <th scope="row" className="px-4 py-3">Total</th>
              <td className="px-4 py-3 text-right tabular">{formatNaira(t.revenueKobo)}</td>
              <td className="px-4 py-3 text-right tabular">{formatNaira(t.expensesKobo)}</td>
              <td className={cx("px-4 py-3 text-right tabular", t.netKobo < 0 && "text-danger")}>{formatNaira(t.netKobo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phone list */}
      <ul className="divide-y divide-line rounded-[var(--radius)] border border-line bg-surface md:hidden">
        {t.days.map((d) => (
          <li key={d.dateKey}>
            <Link href={`/admin/finances/day/${d.dateKey}`} className={cx("flex items-center gap-3 px-4 py-3", d.revenueKobo === 0 && d.expensesKobo === 0 && "text-ink-3")}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{formatDateKey(d.dateKey)}</span>
                <span className="block text-xs tabular">
                  In {formatNaira(d.revenueKobo)} · Out {formatNaira(d.expensesKobo)}
                </span>
              </span>
              <span className={cx("tabular font-semibold", d.netKobo < 0 && "text-danger")}>{formatNaira(d.netKobo)}</span>
              <ChevronRight aria-hidden className="size-4 text-ink-3" />
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-3 bg-sand/40 px-4 py-3 font-semibold">
          <span className="flex-1">Total</span>
          <span className={cx("tabular", t.netKobo < 0 && "text-danger")}>{formatNaira(t.netKobo)}</span>
          <span className="size-4" />
        </li>
      </ul>
    </>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</dt>
      <dd className={cx("mt-1 font-display text-3xl tabular", tone)}>{value}</dd>
    </div>
  );
}
