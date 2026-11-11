import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getAdminData, joinBooking } from "@/server/queries";
import { balanceDue, paidKobo, paymentSummaryState } from "@/domain/pricing";
import { bookingStatusLabel, paymentSummaryLabel } from "@/domain/labels";
import type { BookingStatus } from "@/domain/types";
import { formatNaira } from "@/lib/money";
import { formatDate, formatTime, lagosDateKey } from "@/lib/time";
import { BookingStatusBadge, PageHeader, PaymentStateBadge } from "@/components/admin/bits";
import { EmptyState, Skeleton, buttonClass, cx, inputClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Bookings" };

type Filters = { q?: string; status?: string; payment?: string; from?: string; to?: string; page?: string };

const PAGE_SIZE = 10;

export default function BookingsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Bookings searchParams={searchParams} />
    </Suspense>
  );
}

async function Bookings({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAdmin();
  const [db, f] = await Promise.all([getAdminData(), searchParams]);
  const q = (f.q ?? "").trim().toLowerCase();

  const rows = db.bookings
    .map((b) => joinBooking(db, b))
    .filter(({ booking, customer, payments }) => {
      if (f.status && booking.status !== f.status) return false;
      if (f.payment && paymentSummaryState(booking, payments) !== f.payment) return false;
      const day = lagosDateKey(booking.startAt);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
      if (q) {
        const hay = [booking.reference, customer.name, customer.phone, customer.email, ...booking.lines.map((l) => l.name)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.booking.startAt.localeCompare(a.booking.startAt));

  const { page: _page, ...filters } = f;
  const active = Object.values(filters).some(Boolean);

  // Totals cover every booking matching the filters, not just the visible page.
  const totalPaid = rows.reduce((s, r) => s + paidKobo(r.payments), 0);
  const totalBalance = rows.reduce((s, r) => s + (balanceDue(r.booking, r.payments) ?? 0), 0);
  const awaitingActual = rows.filter((r) => r.booking.actualTotalKobo === null && ["confirmed", "completed"].includes(r.booking.status)).length;

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(_page ?? "1", 10) || 1), pageCount);
  const firstIndex = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(firstIndex, firstIndex + PAGE_SIZE);
  const hrefFor = (n: number) => {
    const params = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1]));
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
  };

  return (
    <>
      <PageHeader title="Bookings" description={`${rows.length} of ${db.bookings.length} bookings`} />

      <form method="get" className="mb-5 grid gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.6fr_1fr_1fr_0.9fr_0.9fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">Search</span>
          <span className="relative block">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input name="q" defaultValue={f.q} placeholder="Name, phone, email, reference" className={`${inputClass} pl-9 text-sm`} />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">Status</span>
          <select name="status" defaultValue={f.status ?? ""} className={`${inputClass} text-sm`}>
            <option value="">Any status</option>
            {(Object.keys(bookingStatusLabel) as BookingStatus[]).map((s) => <option key={s} value={s}>{bookingStatusLabel[s].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">Payment</span>
          <select name="payment" defaultValue={f.payment ?? ""} className={`${inputClass} text-sm`}>
            <option value="">Any payment</option>
            {Object.entries(paymentSummaryLabel).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">From</span>
          <input type="date" name="from" defaultValue={f.from} className={`${inputClass} text-sm`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">To</span>
          <input type="date" name="to" defaultValue={f.to} className={`${inputClass} text-sm`} />
        </label>
        <div className="flex items-end gap-2">
          <button className={buttonClass("night", "md", "w-full lg:w-auto")}>Filter</button>
          {active && (
            <Link href="/admin/bookings" className={buttonClass("ghost", "md", "px-3")}>
              <X aria-hidden className="size-4" /><span className="sr-only">Clear filters</span>
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No bookings match these filters" action={<Link href="/admin/bookings" className="font-semibold underline">Clear filters</Link>} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-line bg-surface xl:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Bookings</caption>
              <thead className="border-b border-line bg-sand/50 text-xs uppercase tracking-[0.08em] text-ink-3">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">When</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Services</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-semibold">Estimated</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actual</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Balance</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map(({ booking, customer, payments }) => {
                  const due = balanceDue(booking, payments);
                  return (
                    <tr key={booking.id} className="hover:bg-sand/40">
                      <td className="whitespace-nowrap px-4 py-3 tabular">
                        <Link href={`/admin/bookings/${booking.id}`} className="font-semibold underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                          {formatDate(booking.startAt)}
                        </Link>
                        <span className="block text-xs text-ink-3">{formatTime(booking.startAt)} · {booking.reference}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/customers/${customer.id}`} className="font-medium hover:underline">{customer.name}</Link>
                        <span className="block text-xs text-ink-3">{customer.phone ?? customer.email}</span>
                      </td>
                      <td className="max-w-56 px-4 py-3 text-ink-2">{booking.lines.filter((l) => l.kind === "booked").map((l) => l.name).join(", ")}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular">{formatNaira(booking.estimatedTotalKobo)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular">
                        {booking.actualTotalKobo === null ? (
                          <span className="text-ink-3" aria-label="Not recorded yet" title="Not recorded yet">—</span>
                        ) : (
                          formatNaira(booking.actualTotalKobo)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular">{formatNaira(paidKobo(payments))}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular font-semibold">{due === null ? <span className="font-normal text-ink-3">—</span> : formatNaira(due)}</td>
                      <td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><BookingStatusBadge status={booking.status} /><PaymentStateBadge booking={booking} payments={payments} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="grid gap-3 lg:grid-cols-2 xl:hidden">
            {pageRows.map(({ booking, customer, payments }) => {
              const due = balanceDue(booking, payments);
              return (
                <li key={booking.id}>
                  <Link href={`/admin/bookings/${booking.id}`} className="block rounded-[var(--radius)] border border-line bg-surface p-4 hover:border-ink">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{customer.name}</p>
                        <p className="tabular text-sm text-ink-2">{formatDate(booking.startAt)}, {formatTime(booking.startAt)}</p>
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{booking.lines.filter((l) => l.kind === "booked").map((l) => l.name).join(", ")}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                      <span className="text-ink-3">{booking.reference}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="tabular">Paid {formatNaira(paidKobo(payments))}</span>
                        {due !== null && due > 0 && <span className="tabular font-semibold text-danger">Due {formatNaira(due)}</span>}
                        <PaymentStateBadge booking={booking} payments={payments} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Pagination page={page} pageCount={pageCount} first={firstIndex + 1} last={firstIndex + pageRows.length} total={rows.length} hrefFor={hrefFor} />

          <TotalsBar count={rows.length} paidKobo={totalPaid} balanceKobo={totalBalance} awaitingActual={awaitingActual} />
        </>
      )}
    </>
  );
}

function Pagination({
  page,
  pageCount,
  first,
  last,
  total,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  first: number;
  last: number;
  total: number;
  hrefFor: (n: number) => string;
}) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pageCount || Math.abs(n - page) <= 1,
  );
  const item = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-[var(--radius-control)] px-2 text-sm font-semibold tabular";
  return (
    <nav aria-label="Bookings pages" className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-ink-2 tabular">
        Showing {first}–{last} of {total}
      </p>
      {pageCount > 1 && (
        <ul className="flex flex-wrap items-center gap-1">
          <li>
            {page > 1 ? (
              <Link href={hrefFor(page - 1)} className={cx(item, "text-ink-2 hover:bg-surface")} aria-label="Previous page">
                <ChevronLeft aria-hidden className="size-4" />
              </Link>
            ) : (
              <span className={cx(item, "text-ink-3/50")} aria-hidden><ChevronLeft className="size-4" /></span>
            )}
          </li>
          {pages.map((n, i) => (
            <li key={n} className="flex items-center gap-1">
              {i > 0 && n - pages[i - 1] > 1 && <span className="px-1 text-ink-3" aria-hidden>…</span>}
              <Link
                href={hrefFor(n)}
                aria-current={n === page ? "page" : undefined}
                aria-label={`Page ${n}`}
                className={cx(item, n === page ? "bg-accent text-on-accent" : "text-ink-2 hover:bg-surface")}
              >
                {n}
              </Link>
            </li>
          ))}
          <li>
            {page < pageCount ? (
              <Link href={hrefFor(page + 1)} className={cx(item, "text-ink-2 hover:bg-surface")} aria-label="Next page">
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <span className={cx(item, "text-ink-3/50")} aria-hidden><ChevronRight className="size-4" /></span>
            )}
          </li>
        </ul>
      )}
    </nav>
  );
}

/** Pinned to the bottom of the admin scroll area so the totals stay visible while scrolling. */
function TotalsBar({ count, paidKobo, balanceKobo, awaitingActual }: { count: number; paidKobo: number; balanceKobo: number; awaitingActual: number }) {
  return (
    <section
      aria-label="Totals for the filtered bookings"
      className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-6px_16px_-8px_rgb(81_54_80/0.18)] backdrop-blur sm:mx-0 sm:rounded-t-[var(--radius)] sm:border sm:border-b-0 sm:px-5"
    >
      <dl className="grid grid-cols-2 items-end gap-x-6 gap-y-2 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-x-8">
        <div className="col-span-2 sm:mr-auto">
          <dt className="type-caps text-[0.68rem] text-ink-3">Totals</dt>
          <dd className="text-ink-2">{count} matching booking{count === 1 ? "" : "s"}, all pages</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Paid</dt>
          <dd className="tabular text-lg font-semibold text-ink">{formatNaira(paidKobo)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Balance due</dt>
          <dd className={cx("tabular text-lg font-semibold", balanceKobo > 0 ? "text-danger" : "text-ink")}>{formatNaira(balanceKobo)}</dd>
        </div>
      </dl>
      {awaitingActual > 0 && (
        <p className="mt-1 text-xs text-ink-3">
          Balance excludes {awaitingActual} booking{awaitingActual === 1 ? "" : "s"} with no actual total recorded yet.
        </p>
      )}
    </section>
  );
}
