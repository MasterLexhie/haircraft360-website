import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Hourglass, MapPin, Phone, ReceiptText } from "lucide-react";
import { getCustomerBooking } from "@/server/queries";
import { bookingStatusLabel } from "@/domain/labels";
import { balanceDue, paidKobo } from "@/domain/pricing";
import { business, fullAddress } from "@/config/business";
import { formatNaira } from "@/lib/money";
import { formatDuration, formatLongDate, formatTime } from "@/lib/time";
import { PaymentHistory } from "@/components/booking/payment-history";
import { PaymentFee } from "@/components/booking/payment-fee";
import { customerPaysFees } from "@/server/payments/paystack";
import { Alert, Badge, ButtonLink, Card, Skeleton } from "@/components/ui/primitives";
import { PayButton } from "../pay-button";
import { PendingRefresher } from "../pending-refresher";

export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string; paid?: string }> };

export default function BookingPage(props: Props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-12"><Skeleton className="h-[28rem]" /></div>}>
      <BookingView {...props} />
    </Suspense>
  );
}

/**
 * The customer's own booking, opened with the link token. Shows only what was entered
 * for this booking: never the stored customer profile or other bookings (finding F-01).
 */
async function BookingView({ params, searchParams }: Props) {
  const [{ reference }, { t, paid }] = await Promise.all([params, searchParams]);
  const data = await getCustomerBooking(reference, t);
  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="type-display text-[2.2rem]">We couldn&apos;t open that booking</h1>
        <p className="mt-3 text-ink-2">The link may be incomplete or out of date. You can still check your booking with its reference and your phone number.</p>
        <ButtonLink href="/booking" className="mt-6">Find my booking</ButtonLink>
      </div>
    );
  }

  const { booking, payments } = data;
  const status = bookingStatusLabel[booking.status];
  const paidTotal = paidKobo(payments);
  const due = balanceDue(booking, payments);
  const minutes = (Date.parse(booking.endAt) - Date.parse(booking.startAt)) / 60_000;
  const token = t!;

  const hero =
    booking.status === "confirmed"
      ? { icon: CheckCircle2, title: "You're booked in", body: "Your deposit was received and your appointment is confirmed." }
      : booking.status === "pending_payment"
        ? { icon: Hourglass, title: "Almost done: deposit needed", body: "Your time is held, but the booking isn't confirmed until the deposit is paid." }
        : booking.status === "completed"
          ? due > 0
            ? { icon: ReceiptText, title: "Thanks for visiting: balance due", body: "You can pay the remaining balance below." }
            : { icon: CheckCircle2, title: "All settled", body: "Your appointment is complete and fully paid. Thank you!" }
          : booking.status === "needs_attention"
            ? { icon: AlertTriangle, title: "Payment received", body: "Your payment arrived after this time was taken. The salon will contact you to arrange a new time." }
            : booking.status === "expired"
              ? { icon: Clock, title: "This hold has ended", body: "The deposit wasn't completed in time, so the time was released. Nothing was charged." }
              : { icon: Clock, title: status.label, body: status.help };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      {paid === "deposit" && booking.status === "confirmed" && (
        <Alert tone="success" role="status" className="mb-6" title="Deposit received: booking confirmed">
          Keep this page&apos;s link to check your booking and pay any balance later.
        </Alert>
      )}
      {paid === "balance" && due === 0 && <Alert tone="success" role="status" className="mb-6" title="Balance received: you're paid in full" />}
      {paid === "pending" && (booking.status === "pending_payment" || due > 0) && (
        <Alert tone="info" role="status" className="mb-6" title="We're waiting for your payment to be confirmed">
          Bank transfers can take a few minutes. Refresh this page in a little while. If money left your account, don&apos;t pay again: it will show here once it lands.
        </Alert>
      )}
      {paid === "failed" && booking.status === "pending_payment" && (
        <Alert tone="danger" role="alert" className="mb-6" title="The payment didn't go through">
          Nothing was charged. You can try again below while your time is held.
        </Alert>
      )}
      {paid === "error" && booking.status === "pending_payment" && (
        <Alert tone="warning" role="alert" className="mb-6" title="Your time is held, but the payment window didn't open">
          Use the button below to pay the deposit before the hold ends.
        </Alert>
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
            <dd className="mt-1 text-ink">{booking.contactName}</dd>
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
          {booking.items.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">{l.kind === "add_on" && <span className="text-ink-3">+ </span>}{l.name}</span>
                {l.kind === "extra" && <span className="ml-2 text-xs text-ink-3">Added at your appointment</span>}
              </span>
              <span className="tabular shrink-0 text-ink-2">{formatNaira(l.priceKobo)}</span>
            </li>
          ))}
        </ul>
        {booking.customerNote && <p className="mt-2 text-sm text-ink-3">Your note: {booking.customerNote}</p>}
      </Card>

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="font-semibold">Payments</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Total" value={formatNaira(booking.totalKobo)} />
          <Row label="Paid so far" value={formatNaira(paidTotal)} />
          <div className="border-t border-line pt-2">
            {booking.status === "pending_payment" ? (
              <Row strong label="Deposit due now" value={formatNaira(booking.depositDueKobo)} />
            ) : (
              <Row strong label={booking.status === "confirmed" ? "Balance due at your visit" : "Balance due"} value={formatNaira(due)} />
            )}
          </div>
        </dl>
        {booking.status === "pending_payment" && <PaymentFee amountKobo={booking.depositDueKobo} show={customerPaysFees()} />}
        {booking.status === "completed" && due > 0 && <PaymentFee amountKobo={due} show={customerPaysFees()} />}

        {booking.status === "pending_payment" && <PendingRefresher />}
        <div className="mt-5">
          {booking.status === "pending_payment" && (
            <PayButton reference={booking.reference} token={token} purpose="deposit" label="Pay deposit" />
          )}
          {booking.status === "completed" && due > 0 && (
            <PayButton reference={booking.reference} token={token} purpose="balance" label={`Pay balance ${formatNaira(due)}`} />
          )}
          {booking.status === "expired" && <ButtonLink href="/book" size="lg">Choose a new time</ButtonLink>}
          {booking.status === "confirmed" && (
            <p className="text-sm text-ink-2">Anything added on the day is included in your balance, which you can pay at the salon or from this page afterwards.</p>
          )}
        </div>

        <h3 className="mt-6 border-t border-line pt-5 text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">Payment history</h3>
        <PaymentHistory payments={payments} showReference={false} />
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
            <p className="text-ink-2">Call the salon. Changes aren&apos;t available online yet.</p>
            <a href={`tel:${business.phone.value.e164}`} className="mt-1 inline-flex min-h-10 items-center font-semibold underline">{business.phone.value.display}</a>
          </div>
        </div>
      </Card>
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
