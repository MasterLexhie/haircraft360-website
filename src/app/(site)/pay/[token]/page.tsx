import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { CalendarDays, CheckCircle2, ReceiptText } from "lucide-react";
import { getPaymentLinkView, PAYMENT_LINK_DAYS } from "@/server/payments/links";
import { business } from "@/config/business";
import { formatNaira } from "@/lib/money";
import { formatLongDate, formatTime } from "@/lib/time";
import { Alert, ButtonLink, Card, Skeleton } from "@/components/ui/primitives";
import { PayLinkButton } from "./pay-link-button";
import { PaymentFee } from "@/components/booking/payment-fee";
import { customerPaysFees } from "@/server/payments/paystack";

export const metadata: Metadata = { title: "Pay your balance", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> };

export default function PayPage(props: Props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl px-4 py-12"><Skeleton className="h-[28rem]" /></div>}>
      <PayView {...props} />
    </Suspense>
  );
}

/** A balance link sent by the salon. Shows only this booking's own details (F-01). */
async function PayView({ params, searchParams }: Props) {
  await connection();
  const [{ token }, { paid }] = await Promise.all([params, searchParams]);
  const view = await getPaymentLinkView(token);
  if (!view) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="type-display text-[2.2rem]">This payment link has expired</h1>
        <p className="mt-3 text-ink-2">Payment links work for {PAYMENT_LINK_DAYS} days. Ask the salon to send a new one, or call {business.phone.value.display}.</p>
        <ButtonLink href="/" variant="secondary" className="mt-6">Go to the home page</ButtonLink>
      </div>
    );
  }
  if (!view.open) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="type-display text-[2.2rem]">This booking is closed</h1>
        <p className="mt-3 text-ink-2">
          Booking {view.reference} can&apos;t be paid online any more. If you have a question about it, call {business.phone.value.display}.
        </p>
        <ButtonLink href="/" variant="secondary" className="mt-6">Go to the home page</ButtonLink>
      </div>
    );
  }
  const settled = view.dueKobo === 0;
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      {paid === "pending" && !settled && (
        <Alert tone="info" role="status" className="mb-6" title="We're waiting for your payment to be confirmed">
          Bank transfers can take a few minutes. Refresh this page in a little while. If money left your account, don&apos;t pay again.
        </Alert>
      )}
      <div className="flex gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft">
          {settled ? <CheckCircle2 aria-hidden className="size-6 text-accent-text" /> : <ReceiptText aria-hidden className="size-6 text-accent-text" />}
        </span>
        <div>
          <h1 className="type-display text-[2.2rem] sm:text-[2.75rem]">{settled ? "All paid, thank you" : "Pay your balance"}</h1>
          <p className="mt-1 text-ink-2">
            {settled ? "Nothing more is owed on this booking." : `For ${view.contactName}'s appointment at ${business.brandName}.`}
          </p>
        </div>
      </div>

      <Card className="mt-8 p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <CalendarDays aria-hidden className="size-4 text-accent-text" />
          {formatLongDate(view.startAt)}, {formatTime(view.startAt)} · <span className="font-semibold tracking-wider text-accent-text">{view.reference}</span>
        </p>
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {view.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-2.5 text-sm">
              <span>{i.kind === "add_on" && <span className="text-ink-3">+ </span>}{i.name}</span>
              <span className="tabular shrink-0 text-ink-2">{formatNaira(i.priceKobo)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink-2">Total</dt><dd className="tabular">{formatNaira(view.totalKobo)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-2">Paid so far</dt><dd className="tabular">{formatNaira(view.paidKobo)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Balance</dt><dd className="tabular">{formatNaira(view.dueKobo)}</dd></div>
        </dl>
        {!settled && <PaymentFee amountKobo={view.dueKobo} show={customerPaysFees()} />}
        {!settled && (
          <div className="mt-5">
            <PayLinkButton token={token} label="Pay balance" />
            <p className="mt-3 text-xs text-ink-3">Pay by card, bank transfer or USSD.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
