import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Receipt } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { requestNow } from "@/server/queries";
import { activeExpenseCategories, listExpenses } from "@/server/expenses";
import { resolvePeriod } from "@/domain/periods";
import { paymentMethodLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatDateKey, lagosDateKey } from "@/lib/time";
import { PageHeader } from "@/components/admin/bits";
import { PeriodPicker } from "@/components/admin/period-picker";
import { Pagination } from "@/components/admin/pagination";
import { pageHref, paginate } from "@/domain/paginate";
import { Alert, EmptyState, Skeleton, buttonClass, cx, inputClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Expenses" };

type Search = { period?: string; from?: string; to?: string; category?: string; page?: string; added?: string };

const EXPENSES_PER_PAGE = 20;

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
  const paged = paginate(rows, params.page, EXPENSES_PER_PAGE);
  const hrefFor = (n: number) => pageHref("/admin/finances/expenses", { period: params.period, from: params.from, to: params.to, category: categoryId }, n);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/finances", label: "Finances" }}
        title="Expenses"
        description="Money out of the business. Add each one when it's paid."
        actions={
          <Link href="/admin/finances/expenses/new" className={buttonClass("night", "md")}>
            <Plus aria-hidden className="size-4" /> Add expense
          </Link>
        }
      />

      {params.added === "1" && <Alert tone="success" role="status" className="mb-6" title="Expense added" />}

      <PeriodPicker action="/admin/finances/expenses" period={period} keep={{ category: categoryId }}>
        <label className="block min-w-0 flex-1 sm:max-w-[260px]">
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
        <ul className="divide-y divide-line rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)]">
          {paged.items.map((e) => (
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
      {rows.length > 0 && <Pagination label="Expenses pages" noun="expenses" {...paged} hrefFor={hrefFor} />}
    </>
  );
}
