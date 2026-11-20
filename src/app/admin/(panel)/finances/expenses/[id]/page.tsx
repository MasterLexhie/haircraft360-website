import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { requestNow } from "@/server/queries";
import { activeExpenseCategories, getExpense } from "@/server/expenses";
import { recordId } from "@/domain/schemas";
import { lagosDateKey } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/bits";
import { DeleteExpense, ExpenseForm } from "@/components/admin/expense-forms";
import { Alert, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Edit expense" };

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <EditExpense params={params} />
    </Suspense>
  );
}

async function EditExpense({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const [{ id }, nowMs] = await Promise.all([params, requestNow()]);
  const parsed = recordId.safeParse(id);
  const expense = parsed.success ? await getExpense(parsed.data) : null;
  if (!expense) notFound();
  const active = await activeExpenseCategories();
  // A category retired since keeps showing for this expense, so the form stays valid to read.
  const categories = active.some((c) => c.id === expense.categoryId) ? active : [...active, { id: expense.categoryId, name: `${expense.categoryName} (no longer used)` }];

  return (
    <>
      <PageHeader back={{ href: "/admin/finances/expenses", label: "Expenses" }} title="Edit expense" />
      {expense.deletedAt ? (
        <Alert tone="warning" title="This expense was deleted">
          It no longer counts in the totals. The activity log keeps its record.
        </Alert>
      ) : (
        <div className="space-y-6">
          <Panel>
            <ExpenseForm expense={expense} categories={categories} todayKey={lagosDateKey(nowMs)} />
          </Panel>
          <Panel>
            <DeleteExpense id={expense.id} />
          </Panel>
        </div>
      )}
    </>
  );
}
