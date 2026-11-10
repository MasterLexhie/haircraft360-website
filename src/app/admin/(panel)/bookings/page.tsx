import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search, X } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getAdminData, joinBooking } from "@/server/queries";
import { balanceDue, paidKobo, paymentSummaryState } from "@/domain/pricing";
import { bookingStatusLabel, paymentSummaryLabel } from "@/domain/labels";
import type { BookingStatus } from "@/domain/types";
import { formatNaira } from "@/lib/money";
import { formatDate, formatTime, lagosDateKey } from "@/lib/time";
import { BookingStatusBadge, PageHeader, PaymentStateBadge } from "@/components/admin/bits";
import { EmptyState, Skeleton, buttonClass, inputClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Bookings" };

type Filters = { q?: string; status?: string; payment?: string; from?: string; to?: string };

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

  const active = Object.values(f).some(Boolean);

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
            <option value="">Any payment state</option>
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
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Est. / actual</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Balance</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ booking, customer, payments }) => {
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
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular">
                        {formatNaira(booking.estimatedTotalKobo)}
                        <span className="block text-xs text-ink-3">{booking.actualTotalKobo === null ? "actual —" : `actual ${formatNaira(booking.actualTotalKobo)}`}</span>
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
            {rows.map(({ booking, customer, payments }) => {
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
        </>
      )}
    </>
  );
}
