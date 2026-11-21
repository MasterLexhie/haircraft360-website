"use server";

import { validateApplication } from "@/domain/academy";
import { sendDueSoon } from "@/server/send-soon";
import { lagosDateKey } from "@/lib/time";
import { openProgramIds, submitApplication } from "@/server/academy";
import { BookingError } from "@/server/booking-service";
import { clientIp, hit, LIMITS, retryMessage } from "@/server/rate-limit";

export type ApplyState =
  | { ok: true; reference: string; programName: string; email: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

const TEXT_FIELDS = ["programId", "fullName", "phone", "email", "dateOfBirth", "city", "state", "experience", "motivation", "howHeard", "consent", "marketingConsent", "website"];

/** The Locs Mastery application form. Checked again here, whatever the browser did. */
export async function applyAction(_: ApplyState, formData: FormData): Promise<ApplyState> {
  const raw: Record<string, string> = {};
  for (const k of TEXT_FIELDS) {
    const v = formData.get(k);
    if (typeof v === "string") raw[k] = v.slice(0, 3000);
  }
  // Honeypot: a hidden field people never fill.
  if (raw.website?.trim()) return { ok: false, error: "Please check your details and try again." };

  const limit = await hit(`application:ip:${await clientIp()}`, LIMITS.applicationPerIp);
  if (!limit.ok) return { ok: false, error: `Too many applications from this connection. ${retryMessage(limit.retryAfterSeconds)}` };

  const parsed = validateApplication(raw, { todayKey: lagosDateKey(Date.now()), programIds: await openProgramIds() });
  if (!parsed.ok) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: parsed.fieldErrors };
  try {
    const { reference, programName } = await submitApplication(parsed.value);
    sendDueSoon();
    return { ok: true, reference, programName, email: parsed.value.email };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    throw err;
  }
}
