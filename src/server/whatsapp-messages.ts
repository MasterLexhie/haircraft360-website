import "server-only";
import { fillTemplate } from "@/domain/messages";
import { formatPhone } from "@/domain/phone";
import { addDays, lagosDateKey, lagosToUtcMs } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";
import { db } from "./db";
import { audit } from "./audit";
import { loadSettings } from "./settings";
import { bookingUrl, ensureMessageToken } from "./booking-access";
import { messageVarsFor } from "./notifications";
import { BookingError, type Actor } from "./booking-service";

/**
 * Reminders due (BUILD_SPEC 6.4 and 6.7): customers without a usable email get their
 * confirmation and reminder on WhatsApp, sent by the owner with one tap. Listed: everything
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
  for (const row of rows) {
    const b = row.booking!;
    const link = bookingUrl(b.reference, await ensureMessageToken(b));
    const text = fillTemplate(row.type === "confirmation" ? messageTemplates.confirmationWhatsapp : messageTemplates.reminderWhatsapp, messageVarsFor(b, link));
    out.push({
      id: row.id,
      type: row.type as ManualMessage["type"],
      bookingId: b.id,
      reference: b.reference,
      name: b.contactName,
      phone: formatPhone(b.contactPhone),
      startAt: b.startAt.toISOString(),
      text,
      whatsappUrl: whatsappLink(b.contactPhone, text),
    });
  }
  return out;
}

/** The owner tapped "Send on WhatsApp": mark it sent so it leaves the list. */
export async function markWhatsappSent(notificationId: string, actor: Actor): Promise<void> {
  await db.$transaction(async (tx) => {
    const row = await tx.notification.findUnique({ where: { id: notificationId }, include: { booking: { select: { id: true, reference: true, customerId: true } } } });
    if (!row || row.channel !== "whatsapp_manual") throw new BookingError("NOT_FOUND", "That message couldn't be found. Reload the page.");
    const updated = await tx.notification.updateMany({
      where: { id: notificationId, status: "pending" },
      data: { status: "sent", sentAt: new Date(), providerMessageId: "whatsapp", lastError: null },
    });
    if (updated.count === 0) return;
    await audit(tx, {
      action: `notification.${row.type}.whatsapp_sent`,
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "Booking",
      entityId: row.booking?.id ?? null,
      bookingId: row.booking?.id ?? null,
      customerId: row.booking?.customerId ?? null,
      summary: `${row.type === "confirmation" ? "Confirmation" : "Reminder"} sent on WhatsApp${row.booking ? ` (${row.booking.reference})` : ""}`,
    });
  });
}
