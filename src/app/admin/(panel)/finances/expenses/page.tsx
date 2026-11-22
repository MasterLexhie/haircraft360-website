import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Receipt } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { requestNow } from "@/server/queries";
import { activeExpenseCategories, countExpenses, listExpenses, type ExpenseRow } from "@/server/expenses";
import { resolvePeriod } from "@/domain/periods";
import { EXPENSES_PATH, financeHref } from "@/domain/finance-nav";
import { paymentMethodLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatDateKey, lagosDateKey } from "@/lib/time";
import { PageHeader } from "@/components/admin/bits";
import { PeriodPicker } from "@/components/admin/period-picker";
import { AddExpenseButton, FinanceActionBar, FinanceTabs } from "@/components/admin/finance-tabs";
import { Pagination } from "@/components/admin/pagination";
import { pageHref, paginate } from "@/domain/paginate";
import { EmptyState, Skeleton, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Expenses" };

type Search = { period?: string; from?: string; to?: string; category?: string; page?: string };

const EXPENSES_PER_PAGE = 20;

/** A row just added is marked for a moment after "Expense added" (see ExpenseAddedToast). */
const FRESH = "transition-colors duration-700 data-fresh:bg-accent-soft";

export default function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Expenses searchParams={searchParams} />
    </Suspense>
  );
}

/** The Expenses tab of Finances: every expense in the period, by day, filtered by category in one tap. */
async function Expenses({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const [params, nowMs] = await Promise.all([searchParams, requestNow()]);
  const period = resolvePeriod(lagosDateKey(nowMs), params);
  const categories = await activeExpenseCategories();
  const categoryId = categories.some((c) => c.id === params.category) ? params.category : undefined;
  const [{ rows, totalKobo }, periodCount] = await Promise.all([
    listExpenses({ fromKey: period.fromKey, toKey: period.toKey, categoryId }),
    // The tab count is for the whole period, whatever category is picked.
    categoryId ? countExpenses(period.fromKey, period.toKey) : null,
  ]);
  const paged = paginate(rows, params.page, EXPENSES_PER_PAGE);
  const periodParams = { period: params.period, from: params.from, to: params.to };
  const hrefFor = (n: number) => pageHref(EXPENSES_PATH, { ...periodParams, category: categoryId }, n);
  const here = financeHref(EXPENSES_PATH, periodParams, { category: categoryId });
  const categoryName = categoryId ? categories.find((c) => c.id === categoryId)!.name : null;

  return (
    <>
      <PageHeader
        phoneBack={{ href: "/admin/more", label: "More" }}
        title="Finances"
        description="Money in, money out, and what's left."
        actions={<AddExpenseButton back={here} />}
        phoneActions={false}
      />
      <FinanceTabs active="expenses" period={periodParams} expenseCount={periodCount ?? rows.length} />

      <PeriodPicker action={EXPENSES_PATH} period={period} keep={{ category: categoryId }} />

      <nav aria-label="Category" className="relative -mx-4 mb-4 md:mx-0">
        <ul className="flex gap-2 overflow-x-auto px-4 pr-10 md:flex-wrap md:px-0 md:pr-0">
          {[{ id: undefined, name: "All categories" }, ...categories].map((c) => {
            const on = c.id === categoryId;
            return (
              <li key={c.id ?? "all"} className="shrink-0">
                <Link
                  href={financeHref(EXPENSES_PATH, periodParams, { category: c.id })}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-9 items-center whitespace-nowrap rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors",
                    on ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface text-ink hover:bg-sand",
                  )}
                >
                  {c.name}
                </Link>
              </li>
            );
          })}
        </ul>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent to-sand md:hidden" />
      </nav>

      <h2 className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold">
        <span>{categoryName ?? "All categories"}</span>
        <span className="tabular">
          {rows.length} {rows.length === 1 ? "expense" : "expenses"} · {formatNaira(totalKobo)}
        </span>
      </h2>

      {rows.length === 0 ? (
        <EmptyState icon={<Receipt aria-hidden className="size-6" />} title={categoryName ? `No ${categoryName} expenses in this period` : "No expenses in this period"} />
      ) : (
        <>
          {/* Phone: grouped by day */}
          <div className="space-y-4 md:hidden">
            {byDay(paged.items).map(([dateKey, items]) => (
              <section key={dateKey} aria-label={formatDateKey(dateKey)}>
                <h3 className="mb-1.5 flex justify-between px-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">
                  {formatDateKey(dateKey)}
                  <span className="font-semibold normal-case tracking-normal tabular">{formatNaira(items.reduce((s, e) => s + e.amountKobo, 0))}</span>
                </h3>
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)]">
                  {items.map((e) => (
                    <li key={e.id} data-expense-id={e.id} className={FRESH}>
                      <Link href={`${EXPENSES_PATH}/${e.id}`} className="flex items-center gap-3 px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{e.categoryName}</span>
                          <span className="block truncate text-xs text-ink-3">
                            {paymentMethodLabel[e.method]}
                            {e.note ? ` · ${e.note}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular">{formatNaira(e.amountKobo)}</span>
                        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* Tablet and desktop: a table */}
          <div className="hidden overflow-x-auto rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)] md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Expenses in {period.label}</caption>
              <thead className="border-b border-line bg-sand/50 text-xs uppercase tracking-[0.08em] text-ink-3">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Paid by</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Note</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paged.items.map((e) => (
                  <tr key={e.id} data-expense-id={e.id} className={cx("hover:bg-sand/40", FRESH)}>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`${EXPENSES_PATH}/${e.id}`} className="font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                        {formatDateKey(e.dateKey)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{e.categoryName}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{paymentMethodLabel[e.method]}</td>
                    <td className="max-w-[320px] truncate px-4 py-2.5 text-ink-2">
                      {e.note}
                      {e.createdByName ? <span className="text-ink-3">{e.note ? " · " : ""}added by {e.createdByName}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular">{formatNaira(e.amountKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination label="Expenses pages" noun="expenses" {...paged} hrefFor={hrefFor} />
        </>
      )}
      <FinanceActionBar back={here} />
    </>
  );
}

function byDay(rows: ExpenseRow[]): [string, ExpenseRow[]][] {
  const groups = new Map<string, ExpenseRow[]>();
  for (const r of rows) groups.set(r.dateKey, [...(groups.get(r.dateKey) ?? []), r]);
  return [...groups];
}
