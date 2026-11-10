import type { Booking, DepositRule, Kobo, Payment, Service } from "./types";

export interface Estimate {
  totalKobo: Kobo;
  durationMinutes: number;
  hasUnpricedItems: boolean;
}

/** Sum the selected services. Unpriced services add ₦0 and are flagged. */
export function estimateServices(services: Service[], defaultDurationMinutes: number): Estimate {
  return services.reduce<Estimate>(
    (acc, s) => ({
      totalKobo: acc.totalKobo + (s.priceKobo ?? 0),
      durationMinutes: acc.durationMinutes + (s.durationMinutes ?? defaultDurationMinutes),
      hasUnpricedItems: acc.hasUnpricedItems || s.priceKobo === null,
    }),
    { totalKobo: 0, durationMinutes: 0, hasUnpricedItems: false },
  );
}

const roundToNaira = (kobo: Kobo) => Math.round(kobo / 100) * 100;

/**
 * Deposit due for an estimate. Percent rules respect the minimum and never
 * exceed a priced estimate; fixed rules charge the fixed amount (capped at a
 * priced estimate). When nothing is priced, the minimum (or fixed) applies.
 */
export function depositFor(estimateKobo: Kobo, rule: DepositRule): Kobo {
  const base = rule.type === "percent" ? roundToNaira((estimateKobo * rule.percent) / 100) : rule.fixedKobo;
  const withMin = Math.max(base, rule.minimumKobo);
  return estimateKobo > 0 ? Math.min(withMin, estimateKobo) : withMin;
}

/** Only successful payments count. Each payment record counts exactly once. */
export function paidKobo(payments: Payment[]): Kobo {
  return payments.filter((p) => p.state === "success").reduce((sum, p) => sum + p.amountKobo, 0);
}

/** balanceDue = max(actualTotal − Σ successful payments, 0). null until the owner records an actual total. */
export function balanceDue(booking: Pick<Booking, "actualTotalKobo">, payments: Payment[]): Kobo | null {
  if (booking.actualTotalKobo === null) return null;
  return Math.max(booking.actualTotalKobo - paidKobo(payments), 0);
}

/** Before completion: what the customer should expect to pay at the appointment. */
export function remainingEstimate(booking: Pick<Booking, "estimatedTotalKobo">, payments: Payment[]): Kobo {
  return Math.max(booking.estimatedTotalKobo - paidKobo(payments), 0);
}

/** Amount paid beyond the actual total (needs owner review; no refund policy exists). */
export function overpaidKobo(booking: Pick<Booking, "actualTotalKobo">, payments: Payment[]): Kobo {
  if (booking.actualTotalKobo === null) return 0;
  return Math.max(paidKobo(payments) - booking.actualTotalKobo, 0);
}

export type PaymentSummaryState = "unpaid" | "deposit_paid" | "balance_due" | "paid_in_full";

export function paymentSummaryState(booking: Pick<Booking, "actualTotalKobo">, payments: Payment[]): PaymentSummaryState {
  const paid = paidKobo(payments);
  const due = balanceDue(booking, payments);
  if (due !== null) return due === 0 ? "paid_in_full" : "balance_due";
  return paid > 0 ? "deposit_paid" : "unpaid";
}
