import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { listAdminBookings, type BookingWhen } from "@/server/admin-queries";
import { requestNow } from "@/server/queries";
import { balanceDue, paidKobo } from "@/domain/pricing";
import { bookingStatusLabel, paymentSummaryLabel } from "@/domain/labels";
import type { Booking, BookingStatus } from "@/domain/types";
import { formatPhone } from "@/domain/phone";
import { formatNaira } from "@/lib/money";
import { formatDate, formatDayHeading, formatTime, lagosDateKey } from "@/lib/time";
import { BookingStatusBadge, PageHeader, PaymentStateBadge } from "@/components/admin/bits";
import { Pagination } from "@/components/admin/pagination";
import { pageHref } from "@/domain/paginate";
import { visitLabel } from "@/domain/crm";
import { paymentSummaryState } from "@/domain/pricing";
import { EmptyState, Skeleton, buttonClass, cx, inputClass } from "@/components/ui/primitives";
import type { AdminBookingRow } from "@/server/admin-queries";

export const metadata: Metadata = { title: "Bookings" };

type Params = { q?: string; status?: string; payment?: string; from?: string; to?: string; when?: string; page?: string; search?: string };

const PAGE_SIZE = 20;

const WHEN: { id: BookingWhen; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
];

/** Status tabs always shown; the rest appear only when something matches them. */
const MAIN_STATUSES: BookingStatus[] = ["pending_payment", "confirmed", "completed", "needs_attention"];

const payDot: Record<string, string> = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info", neutral: "bg-ink-3", accent: "bg-accent" };
const payText: Record<string, string> = { success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-info", neutral: "text-ink-3", accent: "text-accent-text" };

export default function BookingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Bookings searchParams={searchParams} />
    </Suspense>
  );
}

async function Bookings({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const [sp, nowMs] = await Promise.all([searchParams, requestNow()]);
  const { page: pageParam, search: openSearch, ...rest } = sp;
  // With no filters the list opens on what's coming up. A link or search that sets any filter shows every date unless it picks a window too.
  const anyFilter = !!(rest.q || rest.status || rest.payment || rest.from || rest.to);
  const when: BookingWhen = (WHEN.find((w) => w.id === rest.when)?.id) ?? (anyFilter ? "all" : "upcoming");
  const filters = { ...rest, when };
  const list = await listAdminBookings(filters, pageParam, PAGE_SIZE, nowMs);
  const { items: rows, allCount, statusCounts, totalPaidKobo, totalBalanceKobo, ...paged } = list;
  const href = (over: Partial<Params>, page = 1) => pageHref("/admin/bookings", { ...filters, ...over }, page);
  const whenLabel = WHEN.find((w) => w.id === when)!.label.toLowerCase();
  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const extraFilters = !!(rest.q || rest.payment || rest.from || rest.to || rest.status);
  const summary = `${list.total} booking${list.total === 1 ? "" : "s"}${when === "all" ? "" : ` · ${whenLabel}`} · paid ${formatNaira(totalPaidKobo)}${totalBalanceKobo > 0 ? ` · ${formatNaira(totalBalanceKobo)} balance due` : ""}`;

  const statusTabs: { id?: BookingStatus; label: string; count: number }[] = [
    { label: "All", count: totalAll },
    ...(Object.keys(bookingStatusLabel) as BookingStatus[])
      .filter((s) => MAIN_STATUSES.includes(s) || statusCounts[s] > 0 || rest.status === s)
      .map((s) => ({ id: s, label: bookingStatusLabel[s].label, count: statusCounts[s] })),
  ];

  const filterFields = (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink-2">Payment</span>
        <select name="payment" defaultValue={rest.payment ?? ""} className={`${inputClass} text-sm`}>
          <option value="">Any payment</option>
          {Object.entries(paymentSummaryLabel).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink-2">From</span>
        <input type="date" name="from" defaultValue={rest.from} className={`${inputClass} text-sm`} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink-2">To</span>
        <input type="date" name="to" defaultValue={rest.to} className={`${inputClass} text-sm`} />
      </label>
    </>
  );

  return (
    <>
      <PageHeader title="Bookings" description={summary} />

      {/* Phone: time window switch, filters behind one button, list grouped by day */}
      <div className="md:hidden">
        <nav aria-label="When" className="-mt-1 mb-3 grid grid-cols-4 gap-1 rounded-xl bg-sand-2 p-1">
          {WHEN.map((w) => (
            <Link
              key={w.id}
              href={href({ when: w.id })}
              aria-current={w.id === when ? "page" : undefined}
              className={cx("grid min-h-9 place-items-center rounded-[9px] text-[0.8rem] font-semibold", w.id === when ? "bg-surface text-night shadow-[0_1px_2px_rgb(62_40_61/0.18)]" : "text-ink-2")}
            >
              {w.label}
            </Link>
          ))}
        </nav>

        <details open={!!openSearch || extraFilters} className="group mb-3">
          <summary className="flex min-h-10 list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
            <span className="flex-1 truncate text-xs text-ink-3">{rest.q && `Results for “${rest.q}”`}</span>
            <span className={cx("inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold", extraFilters ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface text-ink")}>
              <SlidersHorizontal aria-hidden className="size-3.5" /> {extraFilters ? "Filters on" : "Search & filter"}
            </span>
          </summary>
          <form method="get" className="mt-2 grid gap-3 rounded-[var(--radius)] bg-surface p-4 shadow-[var(--shadow-admin-card)]">
            <input type="hidden" name="when" value={when} />
            <SearchField defaultValue={rest.q} autoFocus={!!openSearch} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-2">Status</span>
              <select name="status" defaultValue={rest.status ?? ""} className={`${inputClass} text-sm`}>
                <option value="">Any status</option>
                {(Object.keys(bookingStatusLabel) as BookingStatus[]).map((s) => <option key={s} value={s}>{bookingStatusLabel[s].label}</option>)}
              </select>
            </label>
            {filterFields}
            <div className="flex gap-2">
              <button className={buttonClass("primary", "md", "flex-1")}>Show bookings</button>
              {extraFilters && <Link href={href({ q: undefined, status: undefined, payment: undefined, from: undefined, to: undefined })} className={buttonClass("secondary", "md")}>Clear</Link>}
            </div>
          </form>
        </details>

        {list.total === 0 ? (
          <EmptyState title={`No ${when === "all" ? "" : whenLabel + " "}bookings${extraFilters ? " match these filters" : ""}`} />
        ) : (
          <div className="-mx-4 bg-surface">
            {groupByDay(rows).map((g) => (
              <section key={g.key} aria-labelledby={`day-${g.key}`}>
                <h2 id={`day-${g.key}`} className="flex justify-between bg-surface px-4 pb-1.5 pt-3.5 text-xs font-bold uppercase tracking-[0.12em] text-accent-text">
                  {g.label}
                  <span className="font-medium normal-case tracking-normal text-ink-3">{g.rows.length} booking{g.rows.length === 1 ? "" : "s"}</span>
                </h2>
                <ul>
                  {g.rows.map((r) => <PhoneRow key={r.booking.id} row={r} />)}
                </ul>
              </section>
            ))}
          </div>
        )}
        <Pagination label="Bookings pages" {...paged} hrefFor={(n) => href({}, n)} />
      </div>

      {/* Tablet and desktop: one card with status tabs, filters, table and pages */}
      <section aria-label="Bookings" className="hidden overflow-hidden rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)] md:block">
        <nav aria-label="Status" className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-2">
          {statusTabs.map((t) => {
            const active = (rest.status ?? undefined) === t.id;
            return (
              <Link
                key={t.label}
                href={href({ status: t.id })}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "-mb-px inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 text-[0.8125rem]",
                  active ? "border-accent bg-sand font-bold text-ink" : "border-transparent font-medium text-ink-2 hover:bg-sand/50",
                )}
              >
                {t.label} <span className="font-medium text-ink-3 tabular">{t.count}</span>
              </Link>
            );
          })}
        </nav>

        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-line p-3">
          {rest.status && <input type="hidden" name="status" value={rest.status} />}
          <div className="min-w-[220px] flex-[2_1_260px]"><SearchField defaultValue={rest.q} label="Search" /></div>
          <label className="block min-w-[150px] flex-1">
            <span className="mb-1 block text-xs font-semibold text-ink-2">When</span>
            <select name="when" defaultValue={when} className={`${inputClass} text-sm`}>
              {WHEN.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </label>
          <div className="grid min-w-[300px] flex-[3_1_380px] grid-cols-3 gap-2">{filterFields}</div>
          <div className="flex gap-2">
            <button className={buttonClass("primary", "md")}>Filter</button>
            {extraFilters && (
              <Link href="/admin/bookings" className={buttonClass("ghost", "md", "px-3")}>
                <X aria-hidden className="size-4" /><span className="sr-only">Clear filters</span>
              </Link>
            )}
          </div>
        </form>

        {list.total === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-2">
            No bookings here. {extraFilters && <Link href="/admin/bookings" className="font-semibold underline">Clear filters</Link>}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.8125rem]">
              <caption className="sr-only">Bookings, {summary}</caption>
              <thead className="bg-sand/60 text-xs text-ink-3">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Booking</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">When</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Customer</th>
                  <th scope="col" className="hidden px-3 py-2.5 font-semibold lg:table-cell">Services</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Total</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Payment</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-soft">
                {rows.map(({ booking, customer, payments, visit }) => {
                  const due = booking.status === "completed" ? balanceDue(booking, payments) : 0;
                  return (
                    <tr key={booking.id} className="hover:bg-sand/40">
                      <td className="whitespace-nowrap px-4 py-3 font-bold">
                        <Link href={`/admin/bookings/${booking.id}`} className="text-accent-text hover:underline">{booking.reference}</Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular">
                        {formatDate(booking.startAt)}
                        <span className="block text-xs text-ink-3">{formatTime(booking.startAt)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/admin/customers/${customer.id}`} className="font-semibold hover:underline">{customer.displayName}</Link>
                        <span className="block text-xs text-ink-3">{visitLabel(visit)} · {formatPhone(booking.contactPhone)}</span>
                      </td>
                      <td className="hidden max-w-56 px-3 py-3 text-ink-2 lg:table-cell">{serviceNames(booking)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular">
                        {formatNaira(booking.totalKobo)}
                        {due > 0 && <span className="block text-xs font-semibold text-danger">{formatNaira(due)} due</span>}
                        {due === 0 && paidKobo(payments) > 0 && <span className="block text-xs text-ink-3">{formatNaira(paidKobo(payments))} paid</span>}
                      </td>
                      <td className="px-3 py-3"><PaymentStateBadge booking={booking} payments={payments} /></td>
                      <td className="px-4 py-3"><BookingStatusBadge status={booking.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-line px-4 pb-3">
          <Pagination label="Bookings pages" {...paged} hrefFor={(n) => href({}, n)} />
        </div>
      </section>
      <p className="mt-3 hidden text-xs text-ink-3 md:block">{allCount} bookings in total.</p>
    </>
  );
}

function SearchField({ defaultValue, autoFocus, label = "Search" }: { defaultValue?: string; autoFocus?: boolean; label?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-2">{label}</span>
      <span className="relative block">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input name="q" type="search" defaultValue={defaultValue} autoFocus={autoFocus} placeholder="Name, phone, email, reference or service" className={`${inputClass} pl-9 text-sm`} />
      </span>
    </label>
  );
}

function PhoneRow({ row: { booking, customer, payments } }: { row: AdminBookingRow }) {
  const pay = paymentSummaryLabel[paymentSummaryState(booking, payments)];
  const status = bookingStatusLabel[booking.status];
  const showStatus = booking.status !== "confirmed";
  return (
    <li>
      <Link href={`/admin/bookings/${booking.id}`} className="grid min-h-14 grid-cols-[68px_minmax(0,1fr)_auto] items-center gap-3 border-b border-accent-soft px-4 py-3 hover:bg-sand/40">
        <span className="whitespace-nowrap text-[0.8125rem] font-bold tabular">{formatTime(booking.startAt)}</span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{customer.displayName}</span>
          <span className="block truncate text-xs text-ink-3">{serviceNames(booking)} · {booking.reference}</span>
          {showStatus && <span className={cx("mt-0.5 block text-[0.7rem] font-semibold", payText[status.tone])}>{status.label}</span>}
        </span>
        <span className="text-right">
          <span className="block text-[0.8125rem] font-semibold tabular">{formatNaira(booking.totalKobo)}</span>
          <span className={cx("inline-flex items-center gap-1 text-[0.7rem] font-semibold", payText[pay.tone])}>
            <span aria-hidden className={cx("size-1.5 rounded-full", payDot[pay.tone])} />
            {pay.label}
          </span>
        </span>
      </Link>
    </li>
  );
}

function groupByDay(rows: AdminBookingRow[]): { key: string; label: string; rows: AdminBookingRow[] }[] {
  const groups: { key: string; label: string; rows: AdminBookingRow[] }[] = [];
  for (const r of rows) {
    const key = lagosDateKey(r.booking.startAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.rows.push(r);
    else groups.push({ key, label: formatDayHeading(r.booking.startAt), rows: [r] });
  }
  return groups;
}

function serviceNames(booking: Booking): string {
  return booking.items.filter((l) => l.kind !== "extra").map((l) => l.name).join(", ");
}
