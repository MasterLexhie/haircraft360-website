"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, FlaskConical, RefreshCw, Timer, XCircle } from "lucide-react";
import type { Kobo, PaymentPurpose, PaymentState } from "@/domain/types";
import { formatNaira } from "@/lib/money";
import { business } from "@/config/business";
import { Alert, Button, ButtonLink } from "@/components/ui/primitives";

/**
 * MOCK CHECKOUT UI — a stand-in for the Paystack-hosted payment page.
 * It deliberately has no card fields. The tester chooses the outcome.
 */
export function MockCheckout(props: {
  reference: string;
  amountKobo: Kobo;
  purpose: PaymentPurpose;
  state: PaymentState;
  bookingReference: string;
  accessToken: string;
  holdExpiresAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"success" | "failed" | "retry" | null>(null);
  const [state, setState] = useState<PaymentState | "expired">(props.state);
  const [error, setError] = useState<string | null>(null);
  const remaining = useCountdown(props.holdExpiresAt);
  const bookingHref = `/booking/${props.bookingReference}?t=${encodeURIComponent(props.accessToken)}`;
  const expired = state === "expired" || state === "abandoned" || (props.purpose === "deposit" && remaining === 0);

  async function simulate(outcome: "success" | "failed") {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch(`/api/checkout/${props.reference}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Something went wrong.");
        return;
      }
      setState(data.status);
      if (data.status === "success") router.push(`${bookingHref}&paid=${props.purpose}`);
    } catch {
      setError("We couldn't reach the checkout service. Nothing has been charged — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function retry() {
    setBusy("retry");
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${props.bookingReference}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.accessToken, purpose: props.purpose === "deposit" ? "deposit" : "balance" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Couldn't start a new attempt.");
        return;
      }
      router.push(`/checkout/${data.checkoutReference}`);
    } finally {
      setBusy(null);
    }
  }

  const what = props.purpose === "deposit" ? "deposit" : "balance";

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <div className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 border-b border-dashed border-line-strong bg-sand px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">
          <FlaskConical aria-hidden className="size-4 text-accent-text" />
          Mock checkout · Paystack stand-in · no real payment
        </div>

        <div className="p-6 sm:p-8">
          <p className="text-sm text-ink-3">Haircraft360 · booking {props.bookingReference}</p>
          <h1 className="mt-1 font-display text-2xl text-accent-text">Demo {what} payment</h1>
          <p className="mt-4 tabular font-display text-5xl font-light">{formatNaira(props.amountKobo)}</p>
          <p className="mt-1 text-xs text-ink-3">Reference {props.reference}</p>

          {props.purpose === "deposit" && remaining !== null && state === "pending" && !expired && (
            <p className="mt-5 flex items-center gap-2 rounded-[var(--radius)] bg-warning-soft px-3 py-2 text-sm text-warning" role="timer" aria-live="off">
              <Timer aria-hidden className="size-4" />
              Your time is held for <strong className="tabular">{formatCountdown(remaining)}</strong>
            </p>
          )}

          <div className="mt-6 space-y-3" aria-live="polite">
            {error && <Alert tone="danger" role="alert" title={error} />}

            {expired ? (
              <>
                <Alert tone="warning" title="This checkout has expired">
                  The hold on your appointment time ended before the deposit was completed, so the time was released and nothing was charged.
                </Alert>
                <ButtonLink href="/book" size="lg" className="w-full">Choose a time again</ButtonLink>
              </>
            ) : state === "success" ? (
              <>
                <Alert tone="success" title="Demo payment successful">This simulated payment has been recorded once. Taking you to your booking…</Alert>
                <ButtonLink href={bookingHref} variant="secondary" className="w-full">View booking</ButtonLink>
              </>
            ) : state === "failed" ? (
              <>
                <Alert tone="danger" title="Payment didn't go through">
                  This simulated payment failed, so nothing was charged.
                  {props.purpose === "deposit"
                    ? " Your booking isn't confirmed yet, but your time is still held until the timer runs out."
                    : " Your balance is still outstanding."}
                </Alert>
                <Button size="lg" className="w-full" onClick={retry} loading={busy === "retry"}>
                  <RefreshCw aria-hidden className="size-4" /> Try again
                </Button>
                <ButtonLink href={bookingHref} variant="ghost" className="w-full">Back to booking</ButtonLink>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-2">
                  In the live site, this step would open Paystack&apos;s secure page. Here you choose what happens:
                </p>
                <Button size="lg" className="w-full" onClick={() => simulate("success")} loading={busy === "success"} disabled={!!busy}>
                  <CheckCircle2 aria-hidden className="size-5" /> Simulate successful payment
                </Button>
                <Button size="lg" variant="secondary" className="w-full" onClick={() => simulate("failed")} loading={busy === "failed"} disabled={!!busy}>
                  <XCircle aria-hidden className="size-5" /> Simulate failed payment
                </Button>
                <Link href={bookingHref} className="block py-2 text-center text-sm font-semibold text-ink-2 underline underline-offset-4">
                  Cancel and return to booking
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-ink-3">
        Need help? Call <a className="font-semibold underline" href={`tel:${business.phone.value.e164}`}>{business.phone.value.display}</a>
      </p>
    </div>
  );
}

function useCountdown(until: string | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!until) return;
    // Start the clock on the client only (avoids a server/client time mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until || now === null) return null;
  return Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
}

function formatCountdown(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
