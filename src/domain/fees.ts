import type { Kobo } from "@/domain/types";

/**
 * Paystack's local (Nigerian) card, transfer and USSD pricing: 1.5%, plus ₦100 on charges of
 * ₦2,500 or more, never more than ₦2,000. https://paystack.com/pricing
 *
 * With "pass fees to customers" on in the Paystack dashboard, Paystack grosses the charge up
 * so the salon still receives the full amount. This estimates the fee the customer sees in
 * the popup. It is only for display: the ledger uses what Paystack's Verify reports.
 * International cards cost more, so the popup's figure is the one that counts.
 */
export const PAYSTACK_LOCAL_PRICING = { rate: 0.015, flatKobo: 10_000, flatFromKobo: 250_000, capKobo: 200_000 } as const;

export function paystackFeeOnTop(amountKobo: Kobo, p = PAYSTACK_LOCAL_PRICING): Kobo {
  if (amountKobo <= 0) return 0;
  const withoutFlat = Math.round(amountKobo / (1 - p.rate));
  const total = withoutFlat < p.flatFromKobo ? withoutFlat : Math.round((amountKobo + p.flatKobo) / (1 - p.rate));
  return Math.min(total - amountKobo, p.capKobo);
}
