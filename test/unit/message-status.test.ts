import { describe, expect, it } from "vitest";
import { messageStatus, type MessageRowLike } from "@/domain/message-status";

const NOTE = "Daily email limit reached; sending resumes after the reset";
const now = Date.parse("2026-11-20T10:00:00.000Z");
const row = (over: Partial<MessageRowLike>): MessageRowLike => ({
  type: "confirmation",
  channel: "email",
  status: "pending",
  dueAt: "2026-11-20T09:00:00.000Z",
  sentAt: null,
  lastError: null,
  ...over,
});

describe("message status labels", () => {
  it("says sent or delivered, and by which route", () => {
    expect(messageStatus(row({ status: "sent" }), now, NOTE).label).toBe("Confirmation sent by email");
    expect(messageStatus(row({ status: "delivered", type: "reminder" }), now, NOTE).label).toBe("Reminder delivered");
    expect(messageStatus(row({ status: "sent", channel: "whatsapp_manual" }), now, NOTE).label).toBe("Confirmation sent on WhatsApp");
  });

  it("shows nothing alarming while a temporary failure retries", () => {
    expect(messageStatus(row({ lastError: "Timeout" }), now, NOTE)).toMatchObject({ label: "Confirmation not sent yet", sendOnWhatsapp: false });
  });

  it("offers WhatsApp and an email fix once the email has failed", () => {
    expect(messageStatus(row({ status: "failed" }), now, NOTE)).toMatchObject({ label: "Couldn't reach this customer by email", sendOnWhatsapp: true, fixEmail: true });
  });

  it("offers WhatsApp when held back by the daily limit", () => {
    expect(messageStatus(row({ lastError: NOTE }), now, NOTE)).toMatchObject({ label: "Confirmation delayed by the daily email limit", sendOnWhatsapp: true });
  });

  it("tells a future reminder from one due now on WhatsApp", () => {
    expect(messageStatus(row({ type: "reminder", dueAt: "2026-11-22T09:00:00.000Z" }), now, NOTE).label).toBe("Reminder goes out by email Sun, 22 Nov, 10:00 am");
    expect(messageStatus(row({ type: "reminder", channel: "whatsapp_manual", dueAt: "2026-11-22T09:00:00.000Z" }), now, NOTE)).toMatchObject({ sendOnWhatsapp: false, tone: "info" });
    expect(messageStatus(row({ channel: "whatsapp_manual" }), now, NOTE)).toMatchObject({ label: "Confirmation to send on WhatsApp", sendOnWhatsapp: true });
  });

  it("explains a skipped message", () => {
    expect(messageStatus(row({ status: "skipped", type: "reminder", lastError: "The booking is cancelled" }), now, NOTE).label).toBe("Reminder not needed: the booking is cancelled");
  });
});
