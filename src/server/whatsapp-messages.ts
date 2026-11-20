import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MessageTemplates } from "@/domain/settings";
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
