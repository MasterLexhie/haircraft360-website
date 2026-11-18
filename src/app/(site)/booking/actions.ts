"use server";

import { findBookingSummary } from "@/server/queries";

export type LookupResult = Awaited<ReturnType<typeof findBookingSummary>>;
export type LookupState = { status: "idle" } | { status: "not_found"; reference: string } | { status: "found"; booking: NonNullable<LookupResult> };

/**
 * Find my booking (decision D6): reference plus the phone or email used for the booking.
 * Returns date, time, status and balance only. Rate limited in Milestone 2 (task S3).
 */
export async function lookupBooking(_: LookupState, formData: FormData): Promise<LookupState> {
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 20);
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 120);
  const booking = reference && contact ? await findBookingSummary(reference, contact) : null;
  return booking ? { status: "found", booking } : { status: "not_found", reference };
}
