import "server-only";
import type { PaymentMethod } from "@/domain/types";
import { balanceDue } from "@/domain/pricing";
import { placeholderDomain, placeholderEmailFor } from "@/domain/phone";
import { sha256Hex } from "@/lib/crypto";
import { db } from "../db";
import { shortCode } from "../ids";
import { BookingError, recordOnlinePayment } from "../booking-service";
import { initializeTransaction, PaystackError, verifyTransaction } from "./paystack";

/**
 * Online payments (BUILD_SPEC 6.4): deposits and balances. Balance links are in ./links.ts.
 *
 * Every press of a Pay button makes a fresh `PaymentAttempt` with our own reference and
 * a server-computed amount. Money only counts once `settlePayment` has asked Paystack's
 * Verify Transaction, whichever arrives first: the webhook or the customer's browser.
 */

/** Booking states a balance can be paid in. */
export const BALANCE_STATUSES = ["confirmed", "completed", "needs_attention", "no_show"] as const;

export interface StartedPayment {
  /** Our reference, also Paystack's. The browser polls with it. */
  reference: string;
  /** Opens the Paystack popup. */
  accessCode: string;
  amountKobo: number;
}

/** Paystack needs an email: the customer's, or the generated one for phone-only customers. */
function payerEmail(booking: { contactEmail: string | null; contactPhone: string }): string {
  return booking.contactEmail ?? placeholderEmailFor(booking.contactPhone, placeholderDomain(process.env.NEXT_PUBLIC_SITE_URL));
}

export async function openAttempt(
  booking: { id: string; reference: string; contactEmail: string | null; contactPhone: string },
  purpose: "deposit" | "balance_online",
  amountKobo: number,
  paymentLinkId?: string,
): Promise<StartedPayment> {
  const reference = `${booking.reference}-${purpose === "deposit" ? "D" : "B"}-${shortCode(6)}`;
  const attempt = await db.paymentAttempt.create({ data: { bookingId: booking.id, purpose, reference, amountKobo, paymentLinkId } });
  try {
    const { accessCode } = await initializeTransaction({
      email: payerEmail(booking),
      amountKobo,
      reference,
      metadata: { bookingId: booking.id, bookingReference: booking.reference, paymentType: purpose },
    });
    await db.paymentAttempt.update({ where: { id: attempt.id }, data: { accessCode } });
    return { reference, accessCode, amountKobo };
  } catch (err) {
    await db.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "failed" } });
    if (err instanceof PaystackError) {
      console.error(`[payments] initialize ${reference} failed: ${err.message}`);
      throw new BookingError("PAYMENT_UNAVAILABLE", "We couldn't open the payment page just now. Please try again in a minute.");
    }
    throw err;
  }
}

/** Deposit or balance, from the customer's own booking link. */
export async function startBookingPayment(reference: string, token: string, purpose: "deposit" | "balance_online"): Promise<StartedPayment> {
  const booking = await db.booking.findUnique({ where: { reference }, include: { payments: true } });
  if (!booking || !token || booking.accessTokenHash !== (await sha256Hex(token)) || booking.accessExpiresAt.getTime() < Date.now()) {
    throw new BookingError("NOT_FOUND", "We couldn't find that booking.");
  }
  if (purpose === "deposit") {
    const holdLive = booking.status === "pending_payment" && booking.holdExpiresAt !== null && booking.holdExpiresAt.getTime() > Date.now();
    if (booking.status === "expired" || (booking.status === "pending_payment" && !holdLive)) {
      throw new BookingError("HOLD_EXPIRED", "The hold on this time has ended. Please book again.");
    }
    if (booking.status !== "pending_payment") throw new BookingError("NOT_ALLOWED", "The deposit for this booking is already settled.");
    return openAttempt(booking, "deposit", booking.depositDueKobo);
  }
  return openAttempt(booking, "balance_online", balanceToPay(booking));
}

export function balanceToPay(booking: { status: string; totalKobo: number; payments: { status: "success" | "failed"; amountKobo: number }[] }): number {
  if (!(BALANCE_STATUSES as readonly string[]).includes(booking.status)) {
    throw new BookingError("NOT_ALLOWED", "There's no balance to pay on this booking.");
  }
  const due = balanceDue(booking, booking.payments);
  if (due === 0) throw new BookingError("NOTHING_DUE", "Nothing is owed on this booking.");
  return due;
}

/* ───────────────────────────── Settling ───────────────────────────── */

export type SettleOutcome = "paid" | "pending" | "failed" | "unknown";

function methodFor(channel: string): PaymentMethod {
  if (channel === "card") return "card";
  if (channel === "bank_transfer" || channel === "bank" || channel === "dedicated_nuban") return "transfer";
  return "other";
}

/** Where an attempt stands, from our own records only (for the browser to poll). */
export async function attemptOutcome(reference: string): Promise<SettleOutcome> {
  const attempt = await db.paymentAttempt.findUnique({ where: { reference }, select: { status: true } });
  if (!attempt) return "unknown";
  return attempt.status === "success" ? "paid" : attempt.status === "failed" ? "failed" : "pending";
}

/**
 * Asks Paystack how a transaction ended and records it. Called by the webhook and by the
 * customer's browser after the popup; safe to call any number of times, in any order.
 */
export async function settlePayment(reference: string, actorLabel: string): Promise<SettleOutcome> {
  const attempt = await db.paymentAttempt.findUnique({ where: { reference } });
  if (!attempt) return "unknown";
  if (attempt.status === "success") return "paid";

  const tx = await verifyTransaction(reference);
  if (tx.status === "failed" || tx.status === "reversed") {
    await db.paymentAttempt.updateMany({ where: { id: attempt.id, status: "initialized" }, data: { status: "failed" } });
    return "failed";
  }
  if (tx.status !== "success") return "pending";
  if (tx.currency !== "NGN" || tx.reference !== reference) {
    throw new PaystackError(`Verify returned ${tx.currency} for ${tx.reference}; expected NGN for ${reference}.`);
  }
  if (tx.requestedKobo !== attempt.amountKobo) {
    throw new PaystackError(`Verify says ${reference} asked for ${tx.requestedKobo} kobo; we asked for ${attempt.amountKobo}.`);
  }
  // With "pass fees to customers" on, Paystack charges the customer our amount plus its fee.
  // The fee is Paystack's money, not the salon's, so it never counts toward the booking.
  const customerFeeKobo = Math.max(tx.amountKobo - tx.requestedKobo, 0);
  const creditedKobo = tx.amountKobo - customerFeeKobo;

  return db.$transaction(async (t): Promise<SettleOutcome> => {
    // Takes the attempt row; a second caller waits here and then finds it already settled.
    const claimed = await t.paymentAttempt.updateMany({ where: { id: attempt.id, status: { not: "success" } }, data: { status: "success" } });
    if (claimed.count === 0) return "paid";
    await recordOnlinePayment(t, attempt.bookingId, {
      type: attempt.purpose,
      method: methodFor(tx.channel),
      amountKobo: creditedKobo,
      customerFeeKobo,
      paystackFeeKobo: tx.feesKobo,
      expectedKobo: attempt.amountKobo,
      paystackReference: reference,
      actorLabel,
    });
    if (attempt.paymentLinkId) {
      const b = await t.booking.findUniqueOrThrow({ where: { id: attempt.bookingId }, include: { payments: true } });
      if (balanceDue(b, b.payments) === 0) await t.paymentLink.update({ where: { id: attempt.paymentLinkId }, data: { usedAt: new Date() } });
    }
    return "paid";
  });
}
