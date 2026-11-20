import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { requestNow } from "@/server/queries";
import { activeExpenseCategories } from "@/server/expenses";
import { lagosDateKey } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/bits";
import { ExpenseForm } from "@/components/admin/expense-forms";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Add expense" };

/** Its own page rather than a modal: the phone's back button returns to the list, and it can be linked to. */
export default function NewExpensePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <NewExpense />
    </Suspense>
  );
}

async function NewExpense() {
  await requireAdmin();
  const [nowMs, categories] = await Promise.all([requestNow(), activeExpenseCategories()]);
  return (
    <>
      <PageHeader back={{ href: "/admin/finances/expenses", label: "Expenses" }} title="Add expense" description="Money paid out of the business." />
      <Panel>
        <ExpenseForm categories={categories} todayKey={lagosDateKey(nowMs)} />
      </Panel>
    </>
  );
}
