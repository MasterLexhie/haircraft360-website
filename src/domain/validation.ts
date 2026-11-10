/** Shared by the booking form (client) and the booking service (server). */

export interface ContactInput {
  name: string;
  phone: string;
  email: string;
}

export type ContactErrors = Partial<Record<"name" | "phone" | "email" | "contact", string>>;

/** Accepts 0805 845 5564, 08058455564, +234 805 845 5564, 2348058455564. */
export function normalizeNigerianPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (/^0[789][01]\d{8}$/.test(digits)) return digits;
  if (/^\+?234[789][01]\d{8}$/.test(digits)) return `0${digits.replace(/^\+?234/, "")}`;
  return null;
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  const name = input.name.trim();
  if (name.length < 2) errors.name = "Enter your name so the salon knows who is coming.";
  else if (name.length > 80) errors.name = "Please keep your name under 80 characters.";

  const phone = input.phone.trim();
  const email = input.email.trim();
  if (!phone && !email) {
    errors.contact = "Add a phone number or an email address so the salon can reach you.";
  }
  if (phone && !normalizeNigerianPhone(phone)) {
    errors.phone = "Enter a Nigerian mobile number, for example 0803 123 4567.";
  }
  if (email && !isValidEmail(email)) {
    errors.email = "Enter an email address like name@example.com.";
  }
  return errors;
}
