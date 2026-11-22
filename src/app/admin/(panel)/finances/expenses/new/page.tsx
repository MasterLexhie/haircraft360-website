import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { requestNow } from "@/server/queries";
import { activeExpenseCategories, lastExpenseMethod } from "@/server/expenses";
import { FINANCES_PATH, financeReturn } from "@/domain/finance-nav";
import { lagosDateKey } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/bits";
import { ExpenseForm } from "@/components/admin/expense-forms";
import { FocusScreen } from "@/components/admin/focus-screen";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Add expense" };

/**
 * Its own page rather than a modal: the phone's back button returns to where it was opened
 * (`back`, the Overview or Expenses tab), and it can be linked to. On a phone it takes the
 * whole screen, with no bottom menu.
 */
export default function NewExpensePage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <NewExpense searchParams={searchParams} />
    </Suspense>
  );
}

async function NewExpense({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  await requireAdmin();
  const [{ back: rawBack }, nowMs, categories, lastMethod] = await Promise.all([searchParams, requestNow(), activeExpenseCategories(), lastExpenseMethod()]);
  const back = financeReturn(rawBack);
  const backLabel = back.startsWith(`${FINANCES_PATH}/expenses`) ? "Expenses" : "Finances";
  return (
    <div className="md:max-w-2xl">
      <FocusScreen />
      <PageHeader back={{ href: back, label: backLabel }} closeIcon title="Add expense" description="Money paid out of the business." />
      <Panel>
        <ExpenseForm categories={categories} todayKey={lagosDateKey(nowMs)} lastMethod={lastMethod} back={back} />
      </Panel>
    </div>
  );
}
