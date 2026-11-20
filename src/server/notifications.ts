import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { balanceDue, paidKobo } from "@/domain/pricing";
import { fillTemplate, type MessageVars } from "@/domain/messages";
import { salonFrom, type Salon } from "@/domain/salon";
import { formatNaira } from "@/lib/money";
import { addDays, formatDateKey, formatLongDate, formatTime, lagosDateKey, lagosMinutes, lagosToUtcMs } from "@/lib/time";
import { buildIcs, googleCalendarUrl } from "@/lib/calendar";
import { db } from "./db";
import { loadSettings } from "./settings";
import { toBooking } from "./mappers";
import { bookingUrl, ensureMessageToken, siteUrl } from "./booking-access";
import { calendarEventFor } from "./booking-calendar";
import { EmailSendError, sendEmail, type EmailMessage } from "./email/transport";
import { confirmationEmail, dailySummaryEmail, ownerAlertEmail, reminderEmail, type SalonInfo } from "./email/templates";
import { settlePayment } from "./payments/checkout";
import { isPaystackConfigured } from "./payments/paystack";

/**
 * The scheduler's sender (BUILD_SPEC 6.4). Notification rows are made with the booking
 * change that causes them; this sends the due ones, a small batch per run.
 *
 * - A row is claimed before sending (nextAttemptAt pushed ahead), so two runs at once
 *   never send the same row.
 * - Marked `sent` only after the provider accepts it, with the provider's message ID.
 * - Failures retry after 1, 3 and 9 hours, then the row is `failed`.
 * - The provider's daily limit stops the batch without using up an attempt.
 * - Before sending, the booking is checked again: cancelled, moved or past means `skipped`.
 */

const HOUR_MS = 3_600_000;
const BATCH = 10;
const CLAIM_MS = 10 * 60_000;
/** Waits after the 1st, 2nd and 3rd failure; the 4th failure is final. */
export const RETRY_AFTER_MS = [1 * HOUR_MS, 3 * HOUR_MS, 9 * HOUR_MS] as const;
export const MAX_ATTEMPTS = RETRY_AFTER_MS.length + 1;
/** Written on emails held back by the provider's daily limit; the dashboard looks for it. */
export const DAILY_LIMIT_NOTE = "Daily email limit reached; sending resumes after the reset";
/** A reminder this close to the confirmation adds nothing: the confirmation covers it. */
const REMINDER_MIN_GAP_MS = 12 * HOUR_MS;

export interface SendResult {
  sent: number;
  skipped: number;
  retrying: number;
  failed: number;
  /** Why the batch stopped early, if it did. */
  stopped?: "daily_limit" | "rate_limited" | "time";
}

type Row = Prisma.NotificationGetPayload<{ include: { booking: { include: { items: true; payments: true } } } }>;

/** The salon's name, address and phone for emails, from Settings. */
export async function salonInfo(salon?: Salon): Promise<SalonInfo> {
  const s = salon ?? salonFrom((await loadSettings()).salonDetails);
  return { name: s.name, address: s.address, mapsUrl: s.mapsUrl, phoneDisplay: s.phone?.display ?? "" };
}

function dueNow(now: Date): Prisma.NotificationWhereInput {
  return { status: "pending", dueAt: { lte: now }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] };
}

/** Why a row shouldn't be sent any more, or null to send it. Booking rows are re-checked here. */
async function skipReason(row: Row, nowMs: number): Promise<string | null> {
  if (row.type !== "confirmation" && row.type !== "reminder") return null;
  const b = row.booking;
  if (!b) return "The booking no longer exists";
  if (b.status !== "confirmed") return `The booking is ${b.status.replace(/_/g, " ")}`;
  if (b.startAt.getTime() <= nowMs) return "The appointment time has passed";
  if (row.type === "reminder") {
    const confirmation = await db.notification.findUnique({ where: { dedupeKey: `confirmation:${b.id}` }, select: { createdAt: true } });
    if (confirmation && row.dueAt.getTime() - confirmation.createdAt.getTime() < REMINDER_MIN_GAP_MS) {
      return "Booked less than a day ahead, so the confirmation covers it";
    }
  }
  return null;
}

/** Placeholder values for the owner's templates, for one booking. */
export function messageVarsFor(b: Row["booking"] & {}, link: string, salon: Pick<Salon, "name" | "address">): MessageVars {
  const booking = toBooking(b);
  const main = booking.items.find((i) => i.kind === "main") ?? booking.items[0];
  return {
    name: b.contactName,
    service: main?.name ?? "appointment",
    date: formatLongDate(booking.startAt),
    time: formatTime(booking.startAt),
    total: formatNaira(b.totalKobo),
    deposit: formatNaira(b.depositDueKobo),
    balance: formatNaira(balanceDue(b, b.payments)),
    link,
    salon: salon.name,
    address: salon.address,
  };
}

async function render(row: Row): Promise<EmailMessage> {
  if (row.type === "owner_alert" || row.type === "owner_daily_summary") {
    const to = process.env.OWNER_NOTIFICATION_EMAIL?.trim();
    if (!to) throw new EmailSendError("OWNER_NOTIFICATION_EMAIL is not set.", "permanent");
    const payload = (row.payload ?? {}) as { message?: string; dateKey?: string };
    if (row.type === "owner_daily_summary") return { to, ...dailySummaryEmail(await dailySummaryData(payload.dateKey ?? lagosDateKey(row.dueAt), row.dueAt.getTime())) };
    return { to, ...ownerAlertEmail(await salonInfo(), payload.message ?? "Something on your admin account needs a look.", `${siteUrl()}/admin`) };
  }

  const b = row.booking!;
  if (!b.contactEmail) throw new EmailSendError("This customer has no email address.", "permanent");
  const booking = toBooking(b);
  const token = await ensureMessageToken(b);
  const link = bookingUrl(b.reference, token);
  const due = balanceDue(b, b.payments);
  const settings = await loadSettings();
  const salon = salonFrom(settings.salonDetails);
  const event = calendarEventFor(booking, salon, { url: link, balanceKobo: due });
  const vars = messageVarsFor(b, link, salon);
  const template = row.type === "confirmation" ? settings.messageTemplates.confirmationEmailIntro : settings.messageTemplates.reminderEmailIntro;
  const data = {
    salon: await salonInfo(salon),
    intro: fillTemplate(template, vars),
    customerName: b.contactName,
    reference: b.reference,
    startAt: booking.startAt,
    durationMinutes: Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60_000),
    items: booking.items.map((i) => ({ name: i.name, priceKobo: i.priceKobo, kind: i.kind })),
    totalKobo: b.totalKobo,
    paidKobo: paidKobo(b.payments),
    balanceKobo: due,
    bookingUrl: link,
    icsUrl: `${siteUrl()}/api/bookings/${b.reference}/calendar?t=${encodeURIComponent(token)}`,
    googleCalendarUrl: googleCalendarUrl(event),
  };
  const email = row.type === "confirmation" ? confirmationEmail(data) : reminderEmail(data);
  return {
    to: b.contactEmail,
    ...email,
    attachments: row.type === "confirmation" ? [{ filename: `${b.reference}.ics`, content: buildIcs(event), contentType: "text/calendar; method=PUBLISH" }] : undefined,
  };
}

/** The next midnight UTC, when Resend's daily quota resets. */
function nextUtcMidnight(nowMs: number): Date {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}

/**
 * WhatsApp rows are sent by the owner by hand (Reminders due). The same checks apply: a
 * cancelled, moved-away or past booking takes them off the list.
 */
async function skipStaleManualRows(now: Date): Promise<number> {
  const { count } = await db.notification.updateMany({
    where: {
      status: "pending",
      channel: "whatsapp_manual",
      type: { in: ["confirmation", "reminder"] },
      OR: [{ booking: null }, { booking: { status: { not: "confirmed" } } }, { booking: { startAt: { lte: now } } }],
    },
    data: { status: "skipped", lastError: "No longer needed: the booking was cancelled, moved or has passed" },
  });
  return count;
}

export async function sendDueNotifications(opts: { nowMs?: number; deadlineMs?: number } = {}): Promise<SendResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const deadline = opts.deadlineMs ?? nowMs + 20_000;
  const now = new Date(nowMs);
  const result: SendResult = { sent: 0, skipped: await skipStaleManualRows(now), retrying: 0, failed: 0 };

  const rows = await db.notification.findMany({
    where: { ...dueNow(now), channel: "email" },
    orderBy: { dueAt: "asc" },
    take: BATCH,
    include: { booking: { include: { items: true, payments: true } } },
  });

  for (const row of rows) {
    if (Date.now() > deadline) {
      result.stopped = "time";
      break;
    }
    // Claim it, so an overlapping run leaves it alone.
    const claimed = await db.notification.updateMany({ where: { id: row.id, ...dueNow(now) }, data: { nextAttemptAt: new Date(Date.now() + CLAIM_MS) } });
    if (claimed.count === 0) continue;

    const reason = await skipReason(row, nowMs);
    if (reason) {
      await db.notification.update({ where: { id: row.id }, data: { status: "skipped", lastError: reason, nextAttemptAt: null } });
      result.skipped++;
      continue;
    }

    try {
      const message = await render(row);
      // The due time is part of the key: a reminder reset by a move is a new message.
      const { id } = await sendEmail(message, `${row.id}:${row.dueAt.getTime()}`);
      await db.notification.update({
        where: { id: row.id },
        data: { status: "sent", sentAt: new Date(), providerMessageId: id, lastError: null, nextAttemptAt: null, attempts: { increment: 1 } },
      });
      result.sent++;
    } catch (err) {
      const kind = err instanceof EmailSendError ? err.kind : "temporary";
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      if (kind === "daily_limit" || kind === "rate_limited") {
        // Not the message's fault: no attempt used. Daily limit waits for the reset.
        await db.notification.update({
          where: { id: row.id },
          data: {
            lastError: kind === "daily_limit" ? DAILY_LIMIT_NOTE : "Email service asked us to slow down",
            nextAttemptAt: kind === "daily_limit" ? nextUtcMidnight(nowMs) : null,
          },
        });
        result.stopped = kind;
        break;
      }
      const attempts = row.attempts + 1;
      const final = kind === "permanent" || attempts >= MAX_ATTEMPTS;
      await db.notification.update({
        where: { id: row.id },
        data: {
          attempts,
          lastError: message,
          status: final ? "failed" : "pending",
          nextAttemptAt: final ? null : new Date(Date.now() + RETRY_AFTER_MS[attempts - 1]!),
        },
      });
      if (final) result.failed++;
      else result.retrying++;
      console.error(`[notifications] ${row.id} ${row.type} attempt ${attempts} failed: ${message}`);
    }
  }
  if (result.stopped === "daily_limit") {
    // The rest wait for the reset too, so the owner sees them as delayed, not failed.
    await db.notification.updateMany({
      where: { ...dueNow(now), channel: "email" },
      data: { lastError: DAILY_LIMIT_NOTE, nextAttemptAt: nextUtcMidnight(nowMs) },
    });
  }
  return result;
}

/** Records that the scheduler ran. The admin warns when this is more than two hours old. */
export async function recordHeartbeat(nowMs = Date.now()): Promise<void> {
  await db.settings.update({ where: { id: 1 }, data: { schedulerHeartbeat: new Date(nowMs) } });
}

/* ───────────────────────────── Owner's daily summary ───────────────────────────── */

/** The summary goes out from this time of day (Lagos), with the first run after it. */
export const SUMMARY_FROM_MINUTES = 7 * 60;

/** Queues today's summary once the morning comes. One per day, however many runs. */
export async function queueDailySummary(nowMs = Date.now()): Promise<boolean> {
  if (lagosMinutes(nowMs) < SUMMARY_FROM_MINUTES) return false;
  const dateKey = lagosDateKey(nowMs);
  const dedupeKey = `summary:${dateKey}`;
  const existing = await db.notification.findUnique({ where: { dedupeKey }, select: { id: true } });
  if (existing) return false;
  await db.notification.upsert({
    where: { dedupeKey },
    create: { dedupeKey, type: "owner_daily_summary", channel: "email", dueAt: new Date(nowMs), payload: { dateKey } },
    update: {},
  });
  return true;
}

/** What the owner's summary says, read when it is sent. */
export async function dailySummaryData(dateKey: string, nowMs = Date.now()) {
  const from = new Date(lagosToUtcMs(dateKey, 0));
  const to = new Date(lagosToUtcMs(addDays(dateKey, 1), 0));
  const since = new Date(nowMs - 24 * HOUR_MS);
  const weekAgo = new Date(nowMs - 7 * 24 * HOUR_MS);
  const [today, fresh, needsTime, failedMessages, manualDue, failedWebhooks] = await Promise.all([
    db.booking.findMany({ where: { startAt: { gte: from, lt: to }, status: { in: ["confirmed", "completed"] } }, include: { items: true, payments: true }, orderBy: { startAt: "asc" } }),
    db.booking.findMany({ where: { createdAt: { gte: since }, status: { in: ["confirmed", "needs_attention"] } }, include: { items: true }, orderBy: { startAt: "asc" } }),
    db.booking.count({ where: { status: "needs_attention" } }),
    db.notification.count({ where: { status: "failed", updatedAt: { gte: weekAgo }, type: { in: ["confirmation", "reminder"] } } }),
    db.notification.count({ where: { status: "pending", channel: "whatsapp_manual", dueAt: { lte: new Date(nowMs) } } }),
    db.webhookEvent.count({ where: { status: "failed", receivedAt: { gte: weekAgo } } }),
  ]);
  const services = (items: { name: string; kind: string }[]) =>
    items
      .filter((i) => i.kind !== "extra")
      .map((i) => i.name)
      .join(", ");
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const attention = [
    needsTime ? `${plural(needsTime, "booking was", "bookings were")} paid after the time was taken: choose a new time` : "",
    manualDue ? `${plural(manualDue, "WhatsApp message is", "WhatsApp messages are")} waiting to be sent (Reminders due)` : "",
    failedMessages ? `${plural(failedMessages, "customer", "customers")} couldn't be reached by email this week: WhatsApp them instead` : "",
    failedWebhooks ? `${plural(failedWebhooks, "payment notice", "payment notices")} couldn't be processed: contact your developer` : "",
  ].filter(Boolean);
  return {
    salon: await salonInfo(),
    dateLabel: formatDateKey(dateKey, { long: true }),
    today: today.map((b) => ({ time: formatTime(b.startAt.toISOString()), name: b.contactName, services: services(b.items), balanceKobo: balanceDue(b, b.payments) })),
    newBookings: fresh.map((b) => ({ when: `${formatLongDate(b.startAt.toISOString())}, ${formatTime(b.startAt.toISOString())}`, name: b.contactName, services: services(b.items) })),
    attention,
    adminUrl: `${siteUrl()}/admin`,
  };
}

/* ───────────────────────────── Payments backstop ───────────────────────────── */

const BACKSTOP_BATCH = 5;
const BACKSTOP_RECHECK_MS = 6 * HOUR_MS;

/**
 * Asks Paystack about payments started 1 to 25 hours ago that are still open. If both the
 * webhook and the customer's browser missed a payment, this records it. Each attempt is
 * asked about at most every 6 hours, and only a few per run, to keep runs short.
 */
export async function checkOpenPayments(nowMs = Date.now(), deadlineMs = nowMs + 8_000): Promise<number> {
  if (!isPaystackConfigured()) return 0;
  const attempts = await db.paymentAttempt.findMany({
    where: {
      status: "initialized",
      createdAt: { gte: new Date(nowMs - 25 * HOUR_MS), lte: new Date(nowMs - HOUR_MS) },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: new Date(nowMs - BACKSTOP_RECHECK_MS) } }],
    },
    orderBy: { createdAt: "asc" },
    take: BACKSTOP_BATCH,
    select: { id: true, reference: true },
  });
  let recovered = 0;
  for (const a of attempts) {
    if (Date.now() > deadlineMs) break;
    await db.paymentAttempt.update({ where: { id: a.id }, data: { lastCheckedAt: new Date(nowMs) } });
    try {
      if ((await settlePayment(a.reference, "Payment check")) === "paid") recovered++;
    } catch (err) {
      console.error(`[notifications] payment check ${a.reference} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return recovered;
}

export interface RunResult extends SendResult {
  /** Payments found and recorded by the backstop. */
  paymentsRecorded: number;
}

/** One scheduler run: heartbeat, the morning summary, the payments backstop, then sending. */
export async function runScheduler(opts: { nowMs?: number; budgetMs?: number } = {}): Promise<RunResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  await recordHeartbeat(nowMs);
  await queueDailySummary(nowMs);
  const paymentsRecorded = await checkOpenPayments(nowMs, Math.min(deadline, Date.now() + 8_000));
  return { ...(await sendDueNotifications({ nowMs, deadlineMs: deadline })), paymentsRecorded };
}
