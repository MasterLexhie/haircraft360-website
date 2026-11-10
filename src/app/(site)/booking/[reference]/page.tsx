import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, CheckCircle2, Clock, Hourglass, MapPin, Phone, ReceiptText } from "lucide-react";
import { getCustomerBooking } from "@/server/queries";
import { bookingStatusLabel } from "@/domain/labels";
import { balanceDue, paidKobo, remainingEstimate } from "@/domain/pricing";
import { business, fullAddress } from "@/config/business";
import { formatNaira } from "@/lib/money";
import { formatDate, formatDuration, formatLongDate, formatTime } from "@/lib/time";
import { PaymentHistory } from "@/components/booking/payment-history";
import { Alert, Badge, ButtonLink, Card, DemoTag, Skeleton } from "@/components/ui/primitives";
import { PayButton } from "../pay-button";

export const metadata: Metadata = { title: "Your booking" };

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string; paid?: string }> };

export default function BookingPage(props: Props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-12"><Skeleton className="h-[28rem]" /></div>}>
      <BookingView {...props} />
    </Suspense>
  );
}

async function BookingView({ params, searchParams }: Props) {
  const [{ reference }, { t, paid }] = await Promise.all([params, searchParams]);
  const data = await getCustomerBooking(reference, t);
  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="type-display text-[2.2rem]">We couldn&apos;t open that booking</h1>
        <p className="mt-3 text-ink-2">The link may be incomplete. Find it with your booking reference and phone number or email.</p>
        <ButtonLink href="/booking" className="mt-6">Find my booking</ButtonLink>
      </div>
    );
  }

  const { booking, customer, payments, history } = data;
  const status = bookingStatusLabel[booking.status];
  const paidTotal = paidKobo(payments);
  const due = balanceDue(booking, payments);
  const remaining = remainingEstimate(booking, payments);
  const minutes = (Date.parse(booking.endAt) - Date.parse(booking.startAt)) / 60_000;
  const token = t!;

  const hero =
    booking.status === "confirmed"
      ? { icon: CheckCircle2, title: "You're booked in", body: "Your demo deposit was received and your appointment is confirmed." }
      : booking.status === "awaiting_deposit"
        ? { icon: Hourglass, title: "Almost done — deposit needed", body: "Your time is held, but the booking isn't confirmed until the demo deposit is paid." }
        : booking.status === "completed"
          ? due && due > 0
            ? { icon: ReceiptText, title: "Thanks for visiting — balance due", body: "The salon has recorded your final bill. You can settle the remaining balance below." }
            : { icon: CheckCircle2, title: "All settled", body: "Your appointment is complete and fully paid. Thank you!" }
          : booking.status === "expired"
            ? { icon: Clock, title: "This hold has ended", body: "The deposit wasn't completed in time, so the time was released. Nothing was charged." }
            : { icon: Clock, title: status.label, body: status.help };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      {paid === "deposit" && booking.status === "confirmed" && (
        <Alert tone="success" role="status" className="mb-6" title="Demo deposit received — booking confirmed">
          Keep this page’s link to check your booking and pay any balance later. (Prototype: no confirmation message is sent.)
        </Alert>
      )}
      {paid === "balance" && due === 0 && (
        <Alert tone="success" role="status" className="mb-6" title="Demo balance payment received — you’re paid in full" />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft">
            <hero.icon aria-hidden className="size-6 text-accent-text" />
          </span>
          <div>
            <h1 className="type-display text-[2.2rem] sm:text-[2.75rem]">{hero.title}</h1>
            <p className="mt-1 text-ink-2">{hero.body}</p>
          </div>
        </div>
        <Badge tone={status.tone} className="self-start">{status.label}</Badge>
      </div>

      <Card className="mt-8 p-5 sm:p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Booking reference</dt>
            <dd className="mt-1 font-display text-2xl tracking-wider text-accent-text">{booking.reference}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Booked for</dt>
            <dd className="mt-1 text-ink">{customer.name}</dd>
          </div>
          <div className="flex gap-3">
            <dt><CalendarDays aria-hidden className="mt-0.5 size-5 text-accent-text" /><span className="sr-only">Date</span></dt>
            <dd className="font-medium">{formatLongDate(booking.startAt)}</dd>
          </div>
          <div className="flex gap-3">
            <dt><Clock aria-hidden className="mt-0.5 size-5 text-accent-text" /><span className="sr-only">Time</span></dt>
            <dd className="font-medium">
              {formatTime(booking.startAt)} <span className="font-normal text-ink-3">· about {formatDuration(minutes)} · Ibadan time</span>
            </dd>
          </div>
        </dl>

        <h2 className="mt-6 border-t border-line pt-5 text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">Services</h2>
        <ul className="mt-2 divide-y divide-line">
          {booking.lines.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">{l.name}</span>
                {l.kind === "extra" && <span className="ml-2 text-xs text-ink-3">Added at appointment</span>}
                {l.serviceStatus === "demo" && l.kind === "booked" && <DemoTag className="ml-2 align-middle">Demo</DemoTag>}
                {booking.status === "completed" && l.kind === "booked" && !l.delivered && <span className="ml-2 text-xs text-ink-3">(not done)</span>}
              </span>
              <span className="tabular shrink-0 text-ink-2">
                {booking.status === "completed" && l.actualPriceKobo !== null
                  ? formatNaira(l.actualPriceKobo)
                  : l.estimatedPriceKobo === null ? "At appointment" : formatNaira(l.estimatedPriceKobo)}
              </span>
            </li>
          ))}
        </ul>
        {booking.completionNote && (
          <p className="mt-2 rounded-[var(--radius)] bg-sand/70 p-3 text-sm text-ink-2"><span className="font-semibold text-ink">Note from the salon:</span> {booking.completionNote}</p>
        )}
        {booking.customerNote && <p className="mt-2 text-sm text-ink-3">Your note: {booking.customerNote}</p>}
      </Card>

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="font-semibold">Payments</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label={booking.actualTotalKobo === null ? "Estimated total" : "Final total (confirmed by salon)"} value={formatNaira(booking.actualTotalKobo ?? booking.estimatedTotalKobo)} />
          {booking.actualTotalKobo !== null && booking.actualTotalKobo !== booking.estimatedTotalKobo && (
            <Row label="Original estimate" value={formatNaira(booking.estimatedTotalKobo)} muted />
          )}
          {booking.hasUnpricedItems && booking.actualTotalKobo === null && <Row label="Plus items priced at appointment" value="—" muted />}
          <Row label="Paid so far" value={formatNaira(paidTotal)} />
          <div className="border-t border-line pt-2">
            {booking.status === "awaiting_deposit" ? (
              <Row strong label="Deposit due now (demo)" value={formatNaira(booking.depositDueKobo)} />
            ) : due !== null ? (
              <Row strong label="Balance due" value={formatNaira(due)} />
            ) : booking.status === "confirmed" ? (
              <Row strong label="Estimated remaining at your visit" value={formatNaira(remaining)} />
            ) : (
              <Row strong label="Balance due" value={formatNaira(0)} />
            )}
          </div>
        </dl>

        <div className="mt-5">
          {booking.status === "awaiting_deposit" && (
            <PayButton reference={booking.reference} token={token} purpose="deposit" label={`Pay demo deposit ${formatNaira(booking.depositDueKobo)}`} />
          )}
          {booking.status === "completed" && due !== null && due > 0 && (
            <PayButton reference={booking.reference} token={token} purpose="balance" label={`Pay balance ${formatNaira(due)} (demo)`} />
          )}
          {booking.status === "expired" && <ButtonLink href="/book" size="lg">Choose a new time</ButtonLink>}
          {booking.status === "confirmed" && (
            <p className="text-sm text-ink-2">
              The salon confirms your final bill after the appointment. Any balance can then be paid from this page.
            </p>
          )}
        </div>

        <h3 className="mt-6 border-t border-line pt-5 text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">Payment history</h3>
        <PaymentHistory payments={payments} />
        <p className="mt-3 text-xs text-ink-3">All payments shown are simulated for this prototype. No money has moved.</p>
      </Card>

      <Card className="mt-6 grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <div className="flex gap-3 text-sm">
          <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-text" />
          <div>
            <p className="font-semibold">Haircraft360</p>
            <p className="text-ink-2">{fullAddress}</p>
            <a href={business.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-10 items-center font-semibold underline">
              Directions<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
        <div className="flex gap-3 text-sm">
          <Phone aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-text" />
          <div>
            <p className="font-semibold">Need to change something?</p>
            <p className="text-ink-2">Call the salon — changes aren&apos;t available online yet.</p>
            <a href={`tel:${business.phone.value.e164}`} className="mt-1 inline-flex min-h-10 items-center font-semibold underline">{business.phone.value.display}</a>
          </div>
        </div>
      </Card>

      {history.length > 1 && (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="font-semibold">Your bookings</h2>
          <ul className="mt-3 divide-y divide-line">
            {history.map((h) => (
              <li key={h.reference} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                {h.isCurrent ? (
                  <span className="font-semibold">{h.reference} <span className="font-normal text-ink-3">(this booking)</span></span>
                ) : (
                  <Link className="font-semibold underline" href={`/booking/${h.reference}?t=${encodeURIComponent(h.token)}`}>{h.reference}</Link>
                )}
                <span className="text-ink-2">{formatDate(h.startAt)}</span>
                <Badge tone={bookingStatusLabel[h.status].tone}>{bookingStatusLabel[h.status].label}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? "text-ink-3" : "text-ink-2"}>{label}</dt>
      <dd className={`tabular ${strong ? "text-lg font-semibold text-ink" : muted ? "text-ink-3" : "font-medium text-ink"}`}>{value}</dd>
    </div>
  );
}
