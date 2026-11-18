// Default (min) metadata: validates number length per country, a fraction of the size of /max.
// Bundle size matters on Workers and in the booking form.
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Phone and email normalisation. Pure functions shared by the booking form and the server.
 *
 * Phones are stored in E.164 (`+2348031234567`) so 0803..., 234803... and +234803...
 * all match the same customer.
 */

export const DEFAULT_PHONE_REGION = "NG";

/** E.164 for a valid number, otherwise null. Numbers without a country code are read as Nigerian. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // "2348031234567" has no + but is clearly international; libphonenumber needs the +.
  const candidate = /^234\d{10}$/.test(trimmed.replace(/[\s()-]/g, "")) ? `+${trimmed}` : trimmed;
  const parsed = parsePhoneNumberFromString(candidate, DEFAULT_PHONE_REGION);
  if (!parsed || !parsed.isValid()) return null;
  // The compact metadata only checks length ranges. Nigerian booking numbers must be mobiles
  // (they receive WhatsApp messages): 10 digits starting 70x, 80x, 81x, 90x or 91x.
  if (parsed.country === "NG" && !/^[789][01]\d{8}$/.test(parsed.nationalNumber)) return null;
  return parsed.number;
}

/** "+2348031234567" -> "0803 123 4567" for Nigerian numbers; international format otherwise. */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "NG" ? parsed.formatNational() : parsed.formatInternational();
}

/** Digits only, for wa.me links ("2348031234567"). */
export function whatsappNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** Trimmed and lowercased. Validation is separate. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/**
 * Paystack requires an email. Customers who tick "I don't have an email" get one
 * generated from their phone. It is flagged as a placeholder and never emailed.
 */
export function placeholderEmailFor(e164: string, domain: string): string {
  return `${whatsappNumber(e164)}@noemail.${domain}`;
}

export function isPlaceholderEmail(email: string): boolean {
  return /@noemail\./.test(email);
}
