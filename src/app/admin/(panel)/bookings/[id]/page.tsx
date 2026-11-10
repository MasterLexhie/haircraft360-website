import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink, Lock, Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getAdminData, joinBooking, requestNow } from "@/server/queries";
import { balanceDue, paidKobo, remainingEstimate } from "@/domain/pricing";
import { bookingStatusLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatDateTime, formatDuration, formatLongDate, formatTime } from "@/lib/time";
import { BookingStatusBadge, KeyValue, PageHeader, Panel, PaymentStateBadge } from "@/components/admin/bits";
import { BalanceLink, CompletionForm, ManualPaymentForm, PrivateNoteForm, StatusActions } from "@/components/admin/booking-forms";
import { PaymentHistory } from "@/components/booking/payment-history";
import { Alert, DemoTag, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Booking detail" };

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const [{ id }, db, nowMs] = await Promise.all([params, getAdminData(), requestNow()]);
  const b = db.bookings.find((x) => x.id === id);
  if (!b) notFound();
  const { booking, customer, payments } = joinBooking(db, b);
  const paid = paidKobo(payments);
  const due = balanceDue(booking, payments);
  const audit = db.audit.filter((e) => e.bookingId === booking.id).sort((x, y) => y.at.localeCompare(x.at));
  const minutes = (Date.parse(booking.endAt) - Date.parse(booking.startAt)) / 60_000;
  const isPast = Date.parse(booking.endAt) < nowMs;
  const canComplete = booking.status === "confirmed" || booking.status === "completed";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/bookings", label: "All bookings" }}
        title={<span className="flex flex-wrap items-center gap-3">{booking.reference} <BookingStatusBadge status={booking.status} /> <PaymentStateBadge booking={booking} payments={payments} /></span>}
        description={`${formatLongDate(booking.startAt)} · ${formatTime(booking.startAt)} – ${formatTime(booking.endAt)} (${formatDuration(minutes)})`}
        actions={<StatusActions bookingId={booking.id} status={booking.status} />}
      />

      {booking.status === "awaiting_deposit" && booking.holdExpiresAt && (
        <Alert tone="warning" className="mb-6" title={`Slot held until ${formatTime(booking.holdExpiresAt)} awaiting the demo deposit`}>
          Not confirmed. If no deposit arrives in time the slot is released automatically.
        </Alert>
      )}
      {booking.status === "confirmed" && isPast && (
        <Alert tone="warning" className="mb-6" title="This appointment has passed">
          Record what was delivered and the actual total below so the balance can be collected.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Services (snapshot at booking)">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">Service</th>
                    <th scope="col" className="pb-2 text-right font-medium">Est. price</th>
                    <th scope="col" className="pb-2 text-right font-medium">Est. time</th>
                    <th scope="col" className="pb-2 text-right font-medium">Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {booking.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium">{l.name}</span>
                        {l.kind === "extra" ? <span className="ml-2 text-xs text-ink-3">extra</span> : l.serviceStatus === "demo" && <DemoTag className="ml-2">Demo</DemoTag>}
                        {booking.status === "completed" && l.kind === "booked" && <span className="block text-xs text-ink-3">{l.delivered ? "Delivered" : "Not delivered"}{l.addOnNote && ` · ${l.addOnNote}`}</span>}
                        {l.kind === "extra" && l.addOnNote && <span className="block text-xs text-ink-3">{l.addOnNote}</span>}
                      </td>
                      <td className="py-2.5 text-right tabular">{l.kind === "extra" ? "—" : l.estimatedPriceKobo === null ? "TBC" : formatNaira(l.estimatedPriceKobo)}</td>
                      <td className="py-2.5 text-right tabular">{l.kind === "extra" ? "—" : formatDuration(l.estimatedDurationMinutes)}</td>
                      <td className="py-2.5 text-right tabular">{l.actualPriceKobo === null ? "—" : formatNaira(l.actualPriceKobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {booking.customerNote && <p className="mt-3 rounded-[var(--radius)] bg-sand/60 p-3 text-sm"><span className="font-semibold">Customer note:</span> {booking.customerNote}</p>}
            {booking.completionNote && <p className="mt-2 rounded-[var(--radius)] bg-sand/60 p-3 text-sm"><span className="font-semibold">Completion note (customer can see):</span> {booking.completionNote}</p>}
          </Panel>

          <Panel title="Money">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label="Estimated total" value={formatNaira(booking.estimatedTotalKobo)} sub={booking.hasUnpricedItems ? "+ unpriced items" : undefined} />
              <Stat label="Actual total" value={booking.actualTotalKobo === null ? "Not set" : formatNaira(booking.actualTotalKobo)} />
              <Stat label="Paid (successful)" value={formatNaira(paid)} sub={`Deposit due was ${formatNaira(booking.depositDueKobo)}`} />
              <Stat
                label={due === null ? "Remaining (estimate)" : "Balance due"}
                value={formatNaira(due ?? remainingEstimate(booking, payments))}
                strong
              />
            </dl>
            {booking.status === "completed" && due !== null && due > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-3 text-sm text-ink-2">Share a link so the customer can pay the {formatNaira(due)} balance through the mock checkout.</p>
                <BalanceLink bookingId={booking.id} />
              </div>
            )}
            <h3 className="mt-6 border-t border-line pt-4 text-xs font-semibold uppercase tracking-[0.1em] text-ink-3">Payment entries</h3>
            <PaymentHistory payments={payments} />
            <details className="mt-4 rounded-[var(--radius)] border border-line">
              <summary className="min-h-11 px-4 py-3 text-sm font-semibold">Record a manual payment</summary>
              <div className="border-t border-line p-4"><ManualPaymentForm bookingId={booking.id} awaitingDeposit={booking.status === "awaiting_deposit"} /></div>
            </details>
          </Panel>

          {canComplete && (
            <section id="complete" className="scroll-mt-20">
              <Panel title={booking.status === "completed" ? "Completion record" : "Complete this appointment"}>
                <CompletionForm booking={booking} paidKobo={paid} />
              </Panel>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Customer" action={<Link href={`/admin/customers/${customer.id}`} className="text-sm font-semibold underline">History</Link>}>
            <p className="font-semibold">{customer.name} {customer.isDemo && <DemoTag className="ml-1">Demo record</DemoTag>}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {customer.phone && <li className="flex items-center gap-2"><Phone aria-hidden className="size-4 text-ink-3" /><a className="underline" href={`tel:${customer.phone}`}>{customer.phone}</a></li>}
              {customer.email && <li className="flex items-center gap-2"><Mail aria-hidden className="size-4 text-ink-3" /><a className="break-all underline" href={`mailto:${customer.email}`}>{customer.email}</a></li>}
            </ul>
            <a href={`/booking/${booking.reference}?t=${encodeURIComponent(booking.accessToken)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold underline">
              Customer&apos;s booking page <ExternalLink aria-hidden className="size-3.5" /><span className="sr-only">(opens in a new tab)</span>
            </a>
          </Panel>

          <Panel title={<span className="flex items-center gap-1.5"><Lock aria-hidden className="size-3.5" /> Private booking note</span>}>
            <PrivateNoteForm kind="booking" id={booking.id} defaultValue={booking.privateNote} />
          </Panel>

          <Panel title="Details">
            <KeyValue
              items={[
                { label: "Created", value: formatDateTime(booking.createdAt) },
                { label: "Status meaning", value: bookingStatusLabel[booking.status].help },
                { label: "Completed", value: booking.completedAt ? formatDateTime(booking.completedAt) : "—" },
                { label: "Data", value: booking.isDemo ? "Demo record" : "Live" },
              ]}
            />
          </Panel>

          <Panel title="Activity">
            <ol className="relative space-y-4 border-l border-line pl-4">
              {audit.map((e) => (
                <li key={e.id} className="text-sm">
                  <span aria-hidden className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-surface bg-ink-3" />
                  <p className="text-ink">{e.summary}</p>
                  <p className="text-xs text-ink-3">{formatDateTime(e.at)} · {e.actor}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`mt-0.5 tabular ${strong ? "text-xl font-semibold" : "font-semibold"}`}>{value}</dd>
      {sub && <dd className="text-xs text-ink-3">{sub}</dd>}
    </div>
  );
}
