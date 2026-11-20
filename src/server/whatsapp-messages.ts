import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MessageTemplates } from "@/domain/settings";
import { messageStatus, type MessageStatus } from "@/domain/message-status";
import { fillTemplate } from "@/domain/messages";
import { formatPhone } from "@/domain/phone";
import { addDays, lagosDateKey, lagosToUtcMs } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";
import { db } from "./db";
import { audit } from "./audit";
import { loadSettings } from "./settings";
import { bookingUrl, ensureMessageToken } from "./booking-access";
import { DAILY_LIMIT_NOTE, messageVarsFor } from "./notifications";
import { BookingError, type Actor } from "./booking-service";

/**
 * Reminders due (BUILD_SPEC 6.4 and 6.7): customers without a usable email get their
 * confirmation and reminder on WhatsApp, sent by the owner, who marks each one sent. Listed: everything
 * due by the end of today in Lagos, so the morning's list covers the whole day.
 */

export interface ManualMessage {
  id: string;
  type: "confirmation" | "reminder";
  bookingId: string;
  reference: string;
  name: string;
  phone: string;
  startAt: string;
  text: string;
  whatsappUrl: string;
}

export async function manualMessagesDue(nowMs = Date.now()): Promise<ManualMessage[]> {
  const endOfToday = new Date(lagosToUtcMs(addDays(lagosDateKey(nowMs), 1), 0));
  const rows = await db.notification.findMany({
    where: {
      status: "pending",
      channel: "whatsapp_manual",
      type: { in: ["confirmation", "reminder"] },
      dueAt: { lt: endOfToday },
      booking: { status: "confirmed", startAt: { gt: new Date(nowMs) } },
    },
    orderBy: [{ booking: { startAt: "asc" } }, { type: "asc" }],
    include: { booking: { include: { items: true, payments: true } } },
  });
  const { messageTemplates } = await loadSettings();
  const out: ManualMessage[] = [];
  for (const row of rows) out.push(await buildManualMessage(row, messageTemplates));
  return out;
}

type MessageRow = Prisma.NotificationGetPayload<{ include: { booking: { include: { items: true; payments: true } } } }>;

/** The WhatsApp version of a booking's confirmation or reminder, in the owner's wording. */
export async function buildManualMessage(row: MessageRow, templates: MessageTemplates): Promise<ManualMessage> {
  const b = row.booking!;
  const link = bookingUrl(b.reference, await ensureMessageToken(b));
  const text = fillTemplate(row.type === "confirmation" ? templates.confirmationWhatsapp : templates.reminderWhatsapp, messageVarsFor(b, link));
  return {
    id: row.id,
    type: row.type as ManualMessage["type"],
    bookingId: b.id,
    reference: b.reference,
    name: b.contactName,
    phone: formatPhone(b.contactPhone),
    startAt: b.startAt.toISOString(),
    text,
    whatsappUrl: whatsappLink(b.contactPhone, text),
  };
}

/**
 * The owner sent it in WhatsApp and tapped "Mark as sent": it leaves the list. Opening WhatsApp
 * alone changes nothing. Also used for an email that failed or is held back by the daily limit:
 * once it has gone on WhatsApp the email is no longer sent.
 */
export async function markWhatsappSent(notificationId: string, actor: Actor): Promise<void> {
  await db.$transaction(async (tx) => {
    const row = await tx.notification.findUnique({ where: { id: notificationId }, include: { booking: { select: { id: true, reference: true, customerId: true } } } });
    const bookingMessage = row?.type === "confirmation" || row?.type === "reminder";
    if (!row || !bookingMessage) throw new BookingError("NOT_FOUND", "That message couldn't be found. Reload the page.");
    // An email still on its way normally isn't offered; only one that failed or is held by the daily limit.
    const sendable: Prisma.NotificationWhereInput =
      row.channel === "whatsapp_manual" ? { status: "pending" } : { OR: [{ status: { in: ["failed", "bounced"] } }, { status: "pending", lastError: DAILY_LIMIT_NOTE }] };
    const updated = await tx.notification.updateMany({
      where: { id: notificationId, ...sendable },
      data: { status: "sent", channel: "whatsapp_manual", sentAt: new Date(), providerMessageId: "whatsapp", nextAttemptAt: null },
    });
    if (updated.count === 0) {
      // Already sent (a second tap) is fine; an email still on its way normally is not for WhatsApp.
      if (row.channel === "email" && row.status === "pending") throw new BookingError("NOT_ALLOWED", "This email is still on its way, so there's nothing to send on WhatsApp.");
      return;
    }
    await audit(tx, {
      action: `notification.${row.type}.whatsapp_sent`,
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "Booking",
      entityId: row.booking?.id ?? null,
      bookingId: row.booking?.id ?? null,
      customerId: row.booking?.customerId ?? null,
      summary: `${row.type === "confirmation" ? "Confirmation" : "Reminder"} sent on WhatsApp${row.channel === "email" ? " instead of email" : ""}${row.booking ? ` (${row.booking.reference})` : ""}`,
    });
  });
}

/* ───────────── The booking page's Messages panel ───────────── */

export interface BookingMessage {
  id: string;
  type: "confirmation" | "reminder";
  status: MessageStatus;
  sentAt: string | null;
  /** Ready to send on WhatsApp, when the status calls for it. */
  manual: ManualMessage | null;
}

export interface BookingMessages {
  messages: BookingMessage[];
  /** "Send on WhatsApp" at any time for an upcoming confirmed booking, whatever happened by email. */
  whatsapp: { confirmation: string; reminder: string } | null;
}

export async function bookingMessages(bookingId: string, nowMs = Date.now()): Promise<BookingMessages> {
  const [rows, booking] = await Promise.all([
    db.notification.findMany({
      where: { bookingId, type: { in: ["confirmation", "reminder"] } },
      orderBy: [{ type: "asc" }],
      include: { booking: { include: { items: true, payments: true } } },
    }),
    db.booking.findUnique({ where: { id: bookingId }, include: { items: true, payments: true } }),
  ]);
  if (!booking) return { messages: [], whatsapp: null };
  const { messageTemplates } = await loadSettings();
  const live = booking.status === "confirmed" && booking.startAt.getTime() > nowMs;
  const messages: BookingMessage[] = [];
  for (const row of rows) {
    const status = messageStatus(
      { type: row.type as BookingMessage["type"], channel: row.channel, status: row.status, dueAt: row.dueAt.toISOString(), sentAt: row.sentAt?.toISOString() ?? null, lastError: row.lastError },
      nowMs,
      DAILY_LIMIT_NOTE,
    );
    messages.push({
      id: row.id,
      type: row.type as BookingMessage["type"],
      status,
      sentAt: row.sentAt?.toISOString() ?? null,
      manual: live && status.sendOnWhatsapp ? await buildManualMessage(row, messageTemplates) : null,
    });
  }
  let whatsapp: BookingMessages["whatsapp"] = null;
  if (live) {
    const vars = messageVarsFor(booking, bookingUrl(booking.reference, await ensureMessageToken(booking)));
    whatsapp = {
      confirmation: whatsappLink(booking.contactPhone, fillTemplate(messageTemplates.confirmationWhatsapp, vars)),
      reminder: whatsappLink(booking.contactPhone, fillTemplate(messageTemplates.reminderWhatsapp, vars)),
    };
  }
  return { messages, whatsapp };
}

/** The balance link message, in the owner's wording, ready to open in WhatsApp. */
export async function balanceLinkWhatsapp(bookingId: string, link: string): Promise<string> {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { items: true, payments: true } });
  const { messageTemplates } = await loadSettings();
  return whatsappLink(booking.contactPhone, fillTemplate(messageTemplates.balanceLinkWhatsapp, messageVarsFor(booking, link)));
}
