import "server-only";
import type { Booking, Database, Kobo, Payment, PaymentPurpose } from "@/domain/types";
import { newId, shortCode } from "../ids";

/**
 * MOCK CHECKOUT ADAPTER — stands in for Paystack. NOTHING here talks to
 * Paystack, collects card details, or moves money. Outcomes are chosen by a
 * person clicking "simulate success / failure" on the mock checkout page.
 *
 * PRODUCTION REPLACEMENT (see README):
 *  - initializeCheckout -> server-side Paystack "initialize transaction" with
 *    the secret key; store the returned reference + authorization URL.
 *  - resolveCheckout     -> run ONLY from a signature-verified Paystack webhook
 *    and/or a server-side "verify transaction" call. Never trust the browser
 *    redirect. Keep the same idempotency rule: a reference resolves once.
 */

export const MOCK_GATEWAY_LABEL = "Mock checkout (Paystack stand-in)";

export function initializeCheckout(
  db: Database,
  params: { booking: Booking; purpose: Exclude<PaymentPurpose, "manual">; amountKobo: Kobo; nowIso: string },
): Payment {
  const payment: Payment = {
    id: newId("pay"),
    bookingId: params.booking.id,
    customerId: params.booking.customerId,
    amountKobo: params.amountKobo,
    purpose: params.purpose,
    state: "pending",
    source: "mock_checkout",
    reference: `MOCK-${params.purpose === "deposit" ? "DEP" : "BAL"}-${shortCode(8)}`,
    createdAt: params.nowIso,
    resolvedAt: null,
    method: null,
    note: "",
    recordedBy: null,
    isDemo: true,
  };
  db.payments.push(payment);
  return payment;
}

export type ResolveOutcome = "success" | "failed" | "abandoned";

/**
 * Idempotent: a payment leaves "pending" exactly once. Repeat calls return the
 * already-recorded result with `alreadyResolved: true` and change nothing.
 */
export function resolveCheckout(
  db: Database,
  reference: string,
  outcome: ResolveOutcome,
  nowIso: string,
): { payment: Payment; alreadyResolved: boolean } | null {
  const payment = db.payments.find((p) => p.reference === reference && p.source === "mock_checkout");
  if (!payment) return null;
  if (payment.state !== "pending") return { payment, alreadyResolved: true };
  payment.state = outcome;
  payment.resolvedAt = nowIso;
  return { payment, alreadyResolved: false };
}
