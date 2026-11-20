import { whatsappLink } from "@/lib/whatsapp";

/**
 * Rules for the dashboard's "Needs your attention" box (BUILD_SPEC 6.7). Only things the
 * owner can act on appear; anything still retrying stays out of sight.
 */

/** The scheduler runs hourly; two hours without a run means it has stopped. */
export const SCHEDULER_STALE_MS = 2 * 3_600_000;

/** How far back system errors are shown. Older ones have either been fixed or already reported. */
export const SYSTEM_ERROR_WINDOW_MS = 7 * 24 * 3_600_000;

export function schedulerStale(heartbeat: string | null, nowMs: number): boolean {
  return heartbeat === null || nowMs - Date.parse(heartbeat) > SCHEDULER_STALE_MS;
}

/**
 * "Contact your developer": WhatsApp to the developer with the problem and a reference code
 * (the related record ID), so they can find it. Null when no developer number is set.
 */
export function developerContactLink(developerPhone: string | undefined, salonName: string, problem: string, reference: string): string | null {
  const digits = developerPhone?.replace(/\D/g, "") ?? "";
  if (digits.length < 8) return null;
  return whatsappLink(digits, `Hello, the ${salonName} admin shows: "${problem}". Reference: ${reference}`);
}
