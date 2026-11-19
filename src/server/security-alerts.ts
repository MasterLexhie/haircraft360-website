import "server-only";
import { db } from "./db";

/**
 * Owner security emails (task S8): a new admin sign-in, and repeated failed sign-ins.
 * Queued as Notification rows; the scheduler sends them (Milestone 5).
 * At most one alert of each kind per account per hour, so a flood of attempts
 * cannot use up Resend's 100-a-day free limit.
 */

export type SecurityAlertKind = "new_sign_in" | "failed_sign_ins";

export async function queueSecurityAlert(kind: SecurityAlertKind, account: string, message: string, nowMs = Date.now()): Promise<void> {
  const hour = new Date(Math.floor(nowMs / 3_600_000) * 3_600_000).toISOString().slice(0, 13);
  const dedupeKey = `alert:${kind}:${account.toLowerCase()}:${hour}`;
  await db.notification.upsert({
    where: { dedupeKey },
    create: { dedupeKey, type: "owner_alert", channel: "email", dueAt: new Date(nowMs), payload: { kind, account, message } },
    update: {},
  });
}
