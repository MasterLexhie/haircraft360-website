import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { requestNow } from "@/server/queries";
import { dailyTotals } from "@/server/finances";
import { countExpenses } from "@/server/expenses";
import { EXPENSES_PATH, FINANCES_PATH, financeHref } from "@/domain/finance-nav";
import { resolvePeriod } from "@/domain/periods";
import { formatNaira } from "@/lib/money";
import { formatDateKey, lagosDateKey } from "@/lib/time";
import { PageHeader } from "@/components/admin/bits";
import { PeriodPicker } from "@/components/admin/period-picker";
import { AddExpenseButton, FinanceActionBar, FinanceTabs } from "@/components/admin/finance-tabs";
import { Pagination } from "@/components/admin/pagination";
import { pageHref, paginate } from "@/domain/paginate";
import { Skeleton, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Finances" };

type Search = { period?: string; from?: string; to?: string; page?: string };

const DAYS_PER_PAGE = 10;

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
  const [t, expenseCount] = await Promise.all([dailyTotals(period.fromKey, period.toKey), countExpenses(period.fromKey, period.toKey)]);
  const paged = paginate(t.days, params.page, DAYS_PER_PAGE);
  const periodParams = { period: params.period, from: params.from, to: params.to };
  const hrefFor = (n: number) => pageHref(FINANCES_PATH, periodParams, n);
  const here = financeHref(FINANCES_PATH, periodParams);

  return (
    <>
      <PageHeader
        phoneBack={{ href: "/admin/more", label: "More" }}
        title="Finances"
        description="Money in, money out, and what's left."
        actions={<AddExpenseButton back={here} />}
        phoneActions={false}
      />
      <FinanceTabs active="overview" period={periodParams} expenseCount={expenseCount} />

      <PeriodPicker action={FINANCES_PATH} period={period} />

      <h2 className="sr-only">{period.label}</h2>
      <dl className="mb-8 grid gap-3 sm:grid-cols-3">
        <Card label="Revenue" value={formatNaira(t.revenueKobo)} hint="Money received from customers" />
        <Card
          label="Expenses"
          value={formatNaira(t.expensesKobo)}
          hint={
            <Link href={financeHref(EXPENSES_PATH, periodParams)} className="inline-flex min-h-8 items-center gap-1 font-semibold text-accent-text underline-offset-4 hover:underline">
              {expenseCount === 0 ? "None yet, see Expenses" : `See ${expenseCount} ${expenseCount === 1 ? "item" : "items"}`}
              <ChevronRight aria-hidden className="size-3.5" />
            </Link>
          }
        />
        <Card label="Net" value={formatNaira(t.netKobo)} hint="Revenue minus expenses" night negative={t.netKobo < 0} />
      </dl>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)] md:block">
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
            {paged.items.map((d) => {
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
              <th scope="row" className="px-4 py-3">Total for the period</th>
              <td className="px-4 py-3 text-right tabular">{formatNaira(t.revenueKobo)}</td>
              <td className="px-4 py-3 text-right tabular">{formatNaira(t.expensesKobo)}</td>
              <td className={cx("px-4 py-3 text-right tabular", t.netKobo < 0 && "text-danger")}>{formatNaira(t.netKobo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phone list */}
      <ul className="divide-y divide-line rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)] md:hidden">
        {paged.items.map((d) => (
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
          <span className="flex-1">Total for the period</span>
          <span className={cx("tabular", t.netKobo < 0 && "text-danger")}>{formatNaira(t.netKobo)}</span>
          <span className="size-4" />
        </li>
      </ul>

      <Pagination label="Finance days pages" noun="days" {...paged} hrefFor={hrefFor} />
      <FinanceActionBar back={here} />
    </>
  );
}

function Card({ label, value, hint, night, negative }: { label: string; value: string; hint?: ReactNode; night?: boolean; negative?: boolean }) {
  return (
    <div className={cx("rounded-[var(--radius)] p-4", night ? "on-night bg-night text-on-night" : "bg-surface shadow-[var(--shadow-admin-card)]")}>
      <dt className={cx("text-xs font-semibold uppercase tracking-[0.12em]", night ? "text-on-night-2" : "text-ink-3")}>{label}</dt>
      <dd className={cx("mt-1 font-display text-3xl tabular", negative && (night ? "text-[#ffb4b4]" : "text-danger"))}>{value}</dd>
      {hint && <dd className={cx("mt-1 text-xs", night ? "text-on-night-2" : "text-ink-3")}>{hint}</dd>}
    </div>
  );
}
