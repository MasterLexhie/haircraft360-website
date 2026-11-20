import "server-only";
import { SYSTEM_ERROR_WINDOW_MS, developerContactLink, schedulerStale } from "@/domain/attention";
import { addDays, lagosDateKey, lagosToUtcMs } from "@/lib/time";
import { db } from "./db";
import { loadSettings } from "./settings";
import { DAILY_LIMIT_NOTE } from "./notifications";
import { buildManualMessage, type ManualMessage } from "./whatsapp-messages";

/**
 * Everything for the dashboard's "Needs your attention" box (BUILD_SPEC 6.7), one row per kind.
 * A message still retrying is left out: the owner can't do anything about it yet.
 */

export interface AttentionBooking {
  id: string;
  reference: string;
  name: string;
  startAt: string;
}

export interface SystemProblem {
  reference: string;
  summary: string;
  at: string;
}

export interface Attention {
  /** Email failed after its retries or bounced: WhatsApp them, or fix the email. */
  unreachable: ManualMessage[];
  /** Held back by the email service's daily limit. */
  delayed: ManualMessage[];
  /** WhatsApp confirmations and reminders for customers without email, due today. */
  whatsappDue: number;
  /** Paid after the time was taken. */
  newTimeNeeded: AttentionBooking[];
  /** Appointments that have ended but aren't marked completed or no-show. */
  toComplete: AttentionBooking[];
  scheduler: { stopped: boolean; lastRunAt: string | null; developerUrl: string | null };
  systemErrors: { problems: SystemProblem[]; developerUrl: string | null };
}

export function attentionCount(a: Attention): number {
  return (
    a.unreachable.length +
    a.delayed.length +
    (a.whatsappDue ? 1 : 0) +
    a.newTimeNeeded.length +
    (a.toComplete.length ? 1 : 0) +
    (a.scheduler.stopped ? 1 : 0) +
    (a.systemErrors.problems.length ? 1 : 0)
  );
}

const bookingMessage = (nowMs: number) => ({ type: { in: ["confirmation" as const, "reminder" as const] }, booking: { status: "confirmed" as const, startAt: { gt: new Date(nowMs) } } });
const withBooking = { booking: { include: { items: true, payments: true } } } as const;

export async function getAttention(nowMs = Date.now()): Promise<Attention> {
  const now = new Date(nowMs);
  const endOfToday = new Date(lagosToUtcMs(addDays(lagosDateKey(nowMs), 1), 0));
  const since = new Date(nowMs - SYSTEM_ERROR_WINDOW_MS);
  const settings = await loadSettings();

  const [failedRows, delayedRows, whatsappDue, newTime, toComplete, badWebhooks, badOwnerEmails] = await Promise.all([
    db.notification.findMany({ where: { channel: "email", status: { in: ["failed", "bounced"] }, ...bookingMessage(nowMs) }, include: withBooking, orderBy: { booking: { startAt: "asc" } } }),
    db.notification.findMany({ where: { channel: "email", status: "pending", lastError: DAILY_LIMIT_NOTE, ...bookingMessage(nowMs) }, include: withBooking, orderBy: { booking: { startAt: "asc" } } }),
    db.notification.count({ where: { channel: "whatsapp_manual", status: "pending", dueAt: { lt: endOfToday }, ...bookingMessage(nowMs) } }),
    db.booking.findMany({ where: { status: "needs_attention" }, orderBy: { startAt: "asc" } }),
    db.booking.findMany({ where: { status: "confirmed", endAt: { lt: now } }, orderBy: { startAt: "asc" } }),
    db.webhookEvent.findMany({ where: { status: "failed", signatureValid: true, receivedAt: { gte: since } }, orderBy: { receivedAt: "desc" }, take: 5 }),
    db.notification.findMany({ where: { type: { in: ["owner_alert", "owner_daily_summary"] }, status: "failed", updatedAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);

  const toItem = (b: { id: string; reference: string; contactName: string; startAt: Date }): AttentionBooking => ({ id: b.id, reference: b.reference, name: b.contactName, startAt: b.startAt.toISOString() });
  const developer = process.env.DEVELOPER_CONTACT_WHATSAPP;
  const salon = settings.salonDetails.name;

  const problems: SystemProblem[] = [
    ...badWebhooks.map((w) => ({ reference: w.id, summary: "A payment message couldn't be processed", at: w.receivedAt.toISOString() })),
    ...badOwnerEmails.map((n) => ({ reference: n.id, summary: "An email to you couldn't be sent", at: n.updatedAt.toISOString() })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  const stopped = schedulerStale(settings.schedulerHeartbeat, nowMs);
  return {
    unreachable: await Promise.all(failedRows.map((r) => buildManualMessage(r, settings))),
    delayed: await Promise.all(delayedRows.map((r) => buildManualMessage(r, settings))),
    whatsappDue,
    newTimeNeeded: newTime.map(toItem),
    toComplete: toComplete.map(toItem),
    scheduler: {
      stopped,
      lastRunAt: settings.schedulerHeartbeat,
      developerUrl: stopped ? developerContactLink(developer, salon, "Reminders aren't running", `scheduler ${settings.schedulerHeartbeat ?? "never ran"}`) : null,
    },
    systemErrors: {
      problems,
      developerUrl: problems.length ? developerContactLink(developer, salon, "Something went wrong", problems.map((p) => p.reference).join(", ")) : null,
    },
  };
}
