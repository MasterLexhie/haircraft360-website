"use server";

import { findBookingSummary } from "@/server/queries";
import { clientIp, hit, LIMITS, retryMessage } from "@/server/rate-limit";

export type LookupResult = Awaited<ReturnType<typeof findBookingSummary>>;
export type LookupState =
  | { status: "idle" }
  | { status: "not_found"; reference: string }
  | { status: "rate_limited"; reference: string; message: string }
  | { status: "found"; booking: NonNullable<LookupResult> };

/**
 * Find my booking (decision D6): reference plus the phone or email used for the booking.
 * Returns date, time, status and balance only. Rate limited per IP so references cannot be guessed at scale.
 */
export async function lookupBooking(_: LookupState, formData: FormData): Promise<LookupState> {
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 20);
  const limit = await hit(`find-booking:ip:${await clientIp()}`, LIMITS.findBookingPerIp);
  if (!limit.ok) return { status: "rate_limited", reference, message: `Too many lookups. ${retryMessage(limit.retryAfterSeconds)}` };
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 120);
  const booking = reference && contact ? await findBookingSummary(reference, contact) : null;
  return booking ? { status: "found", booking } : { status: "not_found", reference };
}
