import Link from "next/link";
import { LineChart, Plus, Receipt } from "lucide-react";
import { EXPENSES_PATH, FINANCES_PATH, financeHref, newExpenseHref, type PeriodParams } from "@/domain/finance-nav";
import { buttonClass, cx } from "@/components/ui/primitives";
import { ExpenseAddedToast } from "./expense-toast";

/**
 * Overview and Expenses: two tabs of one Finances section, styled like Settings. Switching
 * tabs keeps the period, so the totals and the list always describe the same days.
 */
export function FinanceTabs({ active, period, expenseCount }: { active: "overview" | "expenses"; period: PeriodParams; expenseCount: number }) {
  const tabs = [
    { id: "overview", label: "Overview", href: financeHref(FINANCES_PATH, period), icon: LineChart, count: null },
    { id: "expenses", label: "Expenses", href: financeHref(EXPENSES_PATH, period), icon: Receipt, count: expenseCount },
  ] as const;
  return (
    <div className="-mx-4 -mt-4 mb-4 border-b border-line bg-surface md:mx-0 md:mt-0 md:mb-4 md:rounded-[var(--radius)] md:shadow-[var(--shadow-admin-card)]">
      <nav aria-label="Finances sections" className="px-3">
        <ul className="flex gap-1">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <li key={t.id} className="max-md:flex-1">
                <Link
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  scroll={false}
                  className={cx(
                    "-mb-px flex min-h-12 items-center justify-center gap-2 whitespace-nowrap border-b-[3px] px-3 text-[0.8125rem] font-semibold transition-colors",
                    on ? "border-accent text-accent-text" : "border-transparent text-ink-3 hover:text-ink",
                  )}
                >
                  <t.icon aria-hidden className="size-4" />
                  {t.label}
                  {t.count !== null && (
                    <span className={cx("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.66rem] font-bold tabular", on ? "bg-accent text-on-accent" : "bg-sand-2 text-ink-2")}>
                      {t.count}
                      <span className="sr-only"> in this period</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** The desktop Add expense button, next to the page title. */
export function AddExpenseButton({ back }: { back: string }) {
  return (
    <Link href={newExpenseHref(back)} className={buttonClass("night", "md")}>
      <Plus aria-hidden className="size-4" /> Add expense
    </Link>
  );
}

/**
 * Phone: Add expense stays in reach above the bottom menu while the page scrolls, and the
 * "Expense added" note appears just above it after a save.
 */
export function FinanceActionBar({ back }: { back: string }) {
  return (
    // From tablet up the bar itself goes away (the button sits by the title) and the note floats bottom right.
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-surface px-4 py-2.5 shadow-[0_-6px_16px_-12px_rgb(62_40_61/0.35)] md:contents">
      <ExpenseAddedToast back={back} />
      <Link href={newExpenseHref(back)} className={buttonClass("night", "md", "w-full md:hidden")}>
        <Plus aria-hidden className="size-4" /> Add expense
      </Link>
    </div>
  );
}
