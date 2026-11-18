import type { Booking, BookingItem, Kobo, Payment, Service } from "./types";

/**
 * Money arithmetic for bookings. Pure; shared by server and client.
 * The ledger (Payment rows) is the only source of what has been paid.
 */

/** Price and duration of a service when sold as an add-on. */
export function addOnTerms(service: Pick<Service, "priceKobo" | "durationMinutes" | "addOnPriceKobo" | "addOnDurationMinutes">) {
  return {
    priceKobo: service.addOnPriceKobo ?? service.priceKobo,
    durationMinutes: service.addOnDurationMinutes ?? service.durationMinutes,
  };
}

export function itemsTotal(items: Pick<BookingItem, "priceKobo">[]): Kobo {
  return items.reduce((sum, i) => sum + i.priceKobo, 0);
}

export function itemsDuration(items: Pick<BookingItem, "durationMinutes">[]): number {
  return items.reduce((sum, i) => sum + i.durationMinutes, 0);
}

/** Sum of successful ledger rows. Corrections (adjustments) may be negative. */
export function paidKobo(payments: Pick<Payment, "status" | "amountKobo">[]): Kobo {
  return payments.filter((p) => p.status === "success").reduce((sum, p) => sum + p.amountKobo, 0);
}

/** Balance owed = booking total minus successful payments, never below zero. */
export function balanceDue(booking: Pick<Booking, "totalKobo">, payments: Pick<Payment, "status" | "amountKobo">[]): Kobo {
  return Math.max(booking.totalKobo - paidKobo(payments), 0);
}

/** Paid beyond the total (shown to the owner; the salon decides what to do). */
export function overpaidKobo(booking: Pick<Booking, "totalKobo">, payments: Pick<Payment, "status" | "amountKobo">[]): Kobo {
  return Math.max(paidKobo(payments) - booking.totalKobo, 0);
}

export type PaymentSummaryState = "unpaid" | "deposit_paid" | "balance_due" | "paid_in_full";

export function paymentSummaryState(booking: Pick<Booking, "totalKobo" | "status">, payments: Pick<Payment, "status" | "amountKobo">[]): PaymentSummaryState {
  const paid = paidKobo(payments);
  const due = balanceDue(booking, payments);
  if (paid > 0 && due === 0) return "paid_in_full";
  if (booking.status === "completed" && due > 0) return "balance_due";
  return paid > 0 ? "deposit_paid" : "unpaid";
}
