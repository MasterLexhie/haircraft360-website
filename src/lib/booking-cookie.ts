/**
 * Customer booking links arrive as /booking/HC-ABC?t=<token> (emails, WhatsApp, the booking
 * form). proxy.ts moves the token into this cookie and reloads the clean address, so the token
 * doesn't stay in browser history, server logs or screenshots. One cookie per booking.
 * Shared by proxy.ts (no database access) and the booking pages.
 */
export function bookingCookieName(reference: string): string {
  return `hc360_bk_${reference.toUpperCase().replace(/[^A-Z0-9-]/g, "")}`;
}

/**
 * Longer than any link can live (bookings up to the booking window ahead, plus 30 days after).
 * The token's own expiry is still checked on every visit.
 */
export const BOOKING_COOKIE_MAX_AGE = 120 * 24 * 60 * 60;
