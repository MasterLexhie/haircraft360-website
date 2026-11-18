import "server-only";
import { balanceDue } from "@/domain/pricing";
import { sha256Hex } from "@/lib/crypto";
import { db } from "../db";
import { BookingError, recordOnlinePayment } from "../booking-service";
import { shortCode } from "../ids";

/**
 * DEVELOPMENT-ONLY stand-in for Paystack, removed in Milestone 4 (task P7).
 *
 * Off unless ENABLE_MOCK_CHECKOUT=true, which is never set in a hosted environment.
 * It moves no money; a person clicks "simulate success" or "simulate failure".
 * Success goes through `recordOnlinePayment`, the same path the Paystack webhook will use.
 * Every call requires the booking's link token, so a checkout reference alone is useless.
 */

export function isMockCheckoutEnabled(): boolean {
  return process.env.ENABLE_MOCK_CHECKOUT === "true";
}

function assertEnabled() {
  if (!isMockCheckoutEnabled()) throw new BookingError("NOT_FOUND", "Online payment isn't available yet.");
}

async function bookingForToken(reference: string, token: string) {
  const booking = await db.booking.findUnique({ where: { reference }, include: { payments: true } });
  if (!booking || !token || booking.accessTokenHash !== (await sha256Hex(token))) {
    throw new BookingError("NOT_FOUND", "We couldn't find that booking.");
  }
  return booking;
}

/** Opens a fresh mock attempt for the deposit or the balance. Never reuses an old one (as with Paystack). */
export async function startMockCheckout(reference: string, token: string, purpose: "deposit" | "balance_online") {
  assertEnabled();
  const booking = await bookingForToken(reference, token);
  let amountKobo: number;
  if (purpose === "deposit") {
    if (booking.status === "expired") throw new BookingError("HOLD_EXPIRED", "The hold on this time has ended. Please book again.");
    if (booking.status !== "pending_payment") throw new BookingError("NOT_ALLOWED", "The deposit for this booking is already settled.");
    amountKobo = booking.depositDueKobo;
  } else {
    amountKobo = balanceDue(booking, booking.payments);
    if (amountKobo === 0) throw new BookingError("NOTHING_DUE", "Nothing is owed on this booking.");
  }
  const attempt = await db.paymentAttempt.create({
    data: { bookingId: booking.id, purpose, reference: `MOCK-${purpose === "deposit" ? "DEP" : "BAL"}-${shortCode(8)}`, amountKobo },
  });
  return { checkoutReference: attempt.reference };
}

export async function getMockCheckout(checkoutReference: string, token: string) {
  if (!isMockCheckoutEnabled()) return null;
  const attempt = await db.paymentAttempt.findUnique({ where: { reference: checkoutReference }, include: { booking: true } });
  if (!attempt || !token || attempt.booking.accessTokenHash !== (await sha256Hex(token))) return null;
  return {
    reference: attempt.reference,
    purpose: attempt.purpose,
    amountKobo: attempt.amountKobo,
    status: attempt.status,
    bookingReference: attempt.booking.reference,
    bookingStatus: attempt.booking.status,
    holdExpiresAt: attempt.booking.holdExpiresAt?.toISOString() ?? null,
  };
}

/** Applies a simulated outcome. Safe to repeat: an attempt resolves once. */
export async function completeMockCheckout(checkoutReference: string, token: string, outcome: "success" | "failed") {
  assertEnabled();
  return db.$transaction(async (tx) => {
    const attempt = await tx.paymentAttempt.findUnique({ where: { reference: checkoutReference }, include: { booking: true } });
    if (!attempt || !token || attempt.booking.accessTokenHash !== (await sha256Hex(token))) {
      throw new BookingError("NOT_FOUND", "We couldn't find that checkout.");
    }
    if (attempt.status !== "initialized") {
      return { status: attempt.status, alreadyResolved: true, bookingReference: attempt.booking.reference, bookingStatus: attempt.booking.status };
    }
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: outcome } });
    let bookingStatus = attempt.booking.status;
    if (outcome === "success") {
      const result = await recordOnlinePayment(tx, attempt.bookingId, {
        type: attempt.purpose,
        method: "card",
        amountKobo: attempt.amountKobo,
        paystackReference: attempt.reference,
        actorLabel: "Mock checkout",
      });
      bookingStatus = result.status;
    }
    return { status: outcome, alreadyResolved: false, bookingReference: attempt.booking.reference, bookingStatus };
  });
}
