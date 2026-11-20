/**
 * Plain-language status for a booking's confirmation and reminder (BUILD_SPEC 6.7), for the
 * booking page. A temporary failure that is still retrying shows as not sent yet: the owner
 * has nothing to do until the retries run out.
 */

export interface MessageRowLike {
  type: "confirmation" | "reminder";
  channel: "email" | "whatsapp_manual";
  status: "pending" | "sent" | "delivered" | "failed" | "skipped" | "bounced";
  dueAt: string;
  sentAt: string | null;
  lastError: string | null;
}

export type MessageTone = "success" | "neutral" | "warning" | "danger" | "info";

export interface MessageStatus {
  label: string;
  tone: MessageTone;
  /** The owner should send it on WhatsApp (and then mark it sent). */
  sendOnWhatsapp: boolean;
  /** A wrong or missing email can be fixed. */
  fixEmail: boolean;
}

export function messageStatus(row: MessageRowLike, nowMs: number, dailyLimitNote: string): MessageStatus {
  const what = row.type === "confirmation" ? "Confirmation" : "Reminder";
  const plain = (label: string, tone: MessageTone): MessageStatus => ({ label, tone, sendOnWhatsapp: false, fixEmail: false });

  switch (row.status) {
    case "delivered":
      return plain(`${what} delivered`, "success");
    case "sent":
      return plain(row.channel === "whatsapp_manual" ? `${what} sent on WhatsApp` : `${what} sent by email`, "success");
    case "failed":
    case "bounced":
      return { label: "Couldn't reach this customer by email", tone: "danger", sendOnWhatsapp: true, fixEmail: true };
    case "skipped":
      return plain(`${what} not needed${row.lastError ? `: ${lowerFirst(row.lastError)}` : ""}`, "neutral");
    case "pending":
      if (row.channel === "whatsapp_manual") {
        return Date.parse(row.dueAt) > nowMs
          ? { label: `${what} to send on WhatsApp from ${dayLabel(row.dueAt)}`, tone: "info", sendOnWhatsapp: false, fixEmail: true }
          : { label: `${what} to send on WhatsApp`, tone: "warning", sendOnWhatsapp: true, fixEmail: true };
      }
      if (row.lastError === dailyLimitNote) return { label: `${what} delayed by the daily email limit`, tone: "warning", sendOnWhatsapp: true, fixEmail: false };
      if (Date.parse(row.dueAt) > nowMs) return plain(`${what} goes out by email ${dayLabel(row.dueAt)}`, "neutral");
      return plain(`${what} not sent yet`, "neutral");
  }
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
}
