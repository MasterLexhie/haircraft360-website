/** Booking contact checks, shared by the booking form (client) and the booking service (server). */
import { isValidEmail, normalizePhone } from "./phone";

export interface ContactInput {
  name: string;
  phone: string;
  email: string;
  /** "I don't have an email" ticked: book with phone only. */
  noEmail: boolean;
}

export type ContactErrors = Partial<Record<"name" | "phone" | "email", string>>;

export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  const name = input.name.trim();
  if (name.length < 2) errors.name = "Enter your name so the salon knows who is coming.";
  else if (name.length > 80) errors.name = "Please keep your name under 80 characters.";

  if (!input.phone.trim()) errors.phone = "Enter your phone number so the salon can reach you.";
  else if (!normalizePhone(input.phone)) errors.phone = "Enter a Nigerian mobile number, for example 0803 123 4567.";

  const email = input.email.trim();
  if (!input.noEmail) {
    if (!email) errors.email = "Enter your email, or tick “I don't have an email”.";
    else if (!isValidEmail(email)) errors.email = "Enter an email address like name@example.com.";
  }
  return errors;
}
