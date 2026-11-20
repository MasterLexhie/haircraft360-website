import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Receipt } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { requestNow } from "@/server/queries";
import { activeExpenseCategories, listExpenses } from "@/server/expenses";
import { resolvePeriod } from "@/domain/periods";
import { paymentMethodLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatDateKey, lagosDateKey } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/bits";
import { PeriodPicker } from "@/components/admin/period-picker";
import { ExpenseForm } from "@/components/admin/expense-forms";
import { EmptyState, Skeleton, cx, inputClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Expenses" };

type Search = { period?: string; from?: string; to?: string; category?: string };

export default function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Expenses searchParams={searchParams} />
    </Suspense>
  );
}

async function Expenses({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const [params, nowMs] = await Promise.all([searchParams, requestNow()]);
  const todayKey = lagosDateKey(nowMs);
  const period = resolvePeriod(todayKey, params);
  const categories = await activeExpenseCategories();
  const categoryId = categories.some((c) => c.id === params.category) ? params.category : undefined;
  const { rows, totalKobo } = await listExpenses({ fromKey: period.fromKey, toKey: period.toKey, categoryId });

  return (
    <>
      <PageHeader back={{ href: "/admin/finances", label: "Finances" }} title="Expenses" description="Money out of the business. Add each one when it's paid." />

      <Panel title="Add an expense" className="mb-8">
        <ExpenseForm categories={categories} todayKey={todayKey} />
      </Panel>

      <PeriodPicker action="/admin/finances/expenses" period={period}>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">Category</span>
          <select name="category" defaultValue={categoryId ?? ""} className={cx(inputClass, "text-sm")}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </PeriodPicker>

      <h2 className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold">
        <span>
          {period.label}
          {categoryId ? ` · ${categories.find((c) => c.id === categoryId)!.name}` : ""}
        </span>
        <span className="tabular">
          {rows.length} {rows.length === 1 ? "expense" : "expenses"} · {formatNaira(totalKobo)}
        </span>
      </h2>

      {rows.length === 0 ? (
        <EmptyState icon={<Receipt aria-hidden className="size-6" />} title="No expenses in this period" />
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius)] border border-line bg-surface">
          {rows.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/finances/expenses/${e.id}`} className="flex items-start justify-between gap-4 p-4 hover:bg-sand/40">
                <span className="min-w-0">
                  <span className="block font-medium">{e.categoryName}</span>
                  <span className="block text-sm text-ink-3">
                    {formatDateKey(e.dateKey)} · {paymentMethodLabel[e.method]}
                    {e.createdByName ? ` · added by ${e.createdByName}` : ""}
                  </span>
                  {e.note && <span className="mt-0.5 block text-sm text-ink-2">{e.note}</span>}
                </span>
                <span className="tabular shrink-0 font-semibold">{formatNaira(e.amountKobo)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
