import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { listAdminCustomers } from "@/server/admin-queries";
import { pageHref } from "@/domain/paginate";
import { Pagination } from "@/components/admin/pagination";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { formatPhone } from "@/domain/phone";
import { PageHeader } from "@/components/admin/bits";
import { EmptyState, Skeleton, buttonClass, inputClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 20;

export default function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const { q, page } = await searchParams;
  const list = await listAdminCustomers(q ?? "", page, PAGE_SIZE);
  const rows = list.items.map((r) => ({ c: r.customer, count: r.bookingCount, paid: r.paidKobo, outstanding: r.outstandingKobo, last: r.lastVisitAt }));

  return (
    <>
      <PageHeader title="Customers" description="Customers are matched by phone number, then email. No customer accounts." />
      <form method="get" className="mb-5 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search customers</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input name="q" defaultValue={q} placeholder="Name, phone or email" className={`${inputClass} pl-9`} />
        </label>
        <button className={buttonClass("night")}>Search</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No customers found" action={<Link href="/admin/customers" className="font-semibold underline">Show all</Link>} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius)] border border-line bg-surface">
          {rows.map(({ c, count, paid, outstanding, last }) => (
            <li key={c.id}>
              <Link href={`/admin/customers/${c.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 hover:bg-sand/50">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.displayName}</span>
                  <span className="block truncate text-sm text-ink-3">{[...c.phones.map(formatPhone), ...c.emails.filter((e) => !e.isPlaceholder).map((e) => e.value)].join(" · ")}</span>
                </span>
                <span className="text-sm text-ink-2">{count} booking{count === 1 ? "" : "s"}{last && ` · last ${formatDate(last)}`}</span>
                <span className="tabular text-sm">Paid {formatNaira(paid)}</span>
                <span className={`tabular text-sm font-semibold ${outstanding ? "text-danger" : "text-ink-3"}`}>{outstanding ? `Owes ${formatNaira(outstanding)}` : "Nothing owed"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.total > 0 && <Pagination label="Customer pages" noun="customers" {...list} hrefFor={(n) => pageHref("/admin/customers", { q }, n)} />}
    </>
  );
}
