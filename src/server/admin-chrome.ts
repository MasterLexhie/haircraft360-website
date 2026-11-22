import "server-only";
import { cache } from "react";
import { requireAdmin } from "./auth";
import { db } from "./db";
import { countManualMessagesDue } from "./whatsapp-messages";

export interface NavCounts {
  /** WhatsApp confirmations and reminders still to send today. */
  reminders: number;
  /** Locs Mastery applications nobody has looked at yet. */
  applications: number;
}

export const NO_COUNTS: NavCounts = { reminders: 0, applications: 0 };

/**
 * What the admin frame shows around every page: who is signed in and the menu counts.
 * Checks the session first so the counts never reach a signed-out visitor. Cached per
 * request, so the top bar, sidebar and bottom bar share one lookup.
 */
export const adminChrome = cache(async (): Promise<{ name: string; email: string; counts: NavCounts }> => {
  const admin = await requireAdmin();
  const [reminders, applications] = await Promise.all([
    countManualMessagesDue(),
    db.programApplication.count({ where: { status: "new" } }),
  ]);
  return { name: admin.name, email: admin.email, counts: { reminders, applications } };
});
