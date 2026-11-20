import "server-only";
import { hmacHex, sha256Hex } from "@/lib/crypto";
import { db } from "./db";

/**
 * Customer booking links. A booking opens with either of two tokens; only their hashes are stored.
 *
 * - The access token is random and shown once, when the customer books.
 * - The message token goes in emails and WhatsApp messages, which are sent later by the
 *   scheduler, when the access token is long gone. It is derived from AUTH_SECRET and the
 *   booking ID, so every retry of a message carries the same link. Changing AUTH_SECRET
 *   stops message links already sent from working; the customer's own link still works.
 */

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function bookingUrl(reference: string, token: string): string {
  return `${siteUrl()}/booking/${reference}?t=${encodeURIComponent(token)}`;
}

async function messageTokenFor(bookingId: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set, so message links can't be made.");
  return hmacHex("SHA-256", secret, `booking-link:${bookingId}`);
}

/** The message token for a booking, storing its hash the first time. */
export async function ensureMessageToken(booking: { id: string; messageTokenHash: string | null }): Promise<string> {
  const token = await messageTokenFor(booking.id);
  const hash = await sha256Hex(token);
  if (booking.messageTokenHash !== hash) {
    await db.booking.update({ where: { id: booking.id }, data: { messageTokenHash: hash } });
    booking.messageTokenHash = hash;
  }
  return token;
}

/** True when the token opens this booking and the link hasn't expired. */
export async function tokenOpensBooking(
  booking: { accessTokenHash: string; messageTokenHash: string | null; accessExpiresAt: Date },
  token: string | undefined | null,
): Promise<boolean> {
  if (!token || booking.accessExpiresAt.getTime() < Date.now()) return false;
  const hash = await sha256Hex(token);
  return hash === booking.accessTokenHash || hash === booking.messageTokenHash;
}
