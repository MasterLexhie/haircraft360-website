import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings, slot } from "../factories";
import { lagosDateKey, lagosToUtcMs } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";

vi.mock("next/server", () => ({ connection: async () => {} }));

const { createPendingBooking, recordManualPayment, findBookingByToken } = await import("@/server/booking-service");
const { manualMessagesDue, markWhatsappSent } = await import("@/server/whatsapp-messages");
const { DAILY_LIMIT_NOTE } = await import("@/server/notifications");

const actor = { id: null, label: "Test admin" };
const HOUR = 3_600_000;

beforeEach(async () => {
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-of-a-decent-length");
  await resetDatabase();
  await createSettings();
  await createServices();
});

afterEach(() => vi.unstubAllEnvs());

async function confirmed(overrides: Record<string, unknown> = {}) {
  const r = await createPendingBooking(bookingInput(overrides));
  const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
  await recordManualPayment(b.id, { amountKobo: b.depositDueKobo, method: "cash", note: "", purpose: "deposit" }, actor);
  return db.booking.findUniqueOrThrow({ where: { id: b.id } });
}

describe("WhatsApp links", () => {
  it("open a chat with the number, the message encoded", () => {
    expect(whatsappLink("+2348035554444", "Hi Ada & co, see you at 10:00?")).toBe("https://wa.me/2348035554444?text=Hi%20Ada%20%26%20co%2C%20see%20you%20at%2010%3A00%3F");
  });
});

describe("Reminders due", () => {
  it("lists phone-only customers' confirmations with the owner's wording and a working link; email customers aren't listed", async () => {
    const phoneOnly = await confirmed({ email: "", noEmail: true, name: "Bola Ade", phone: "0803 555 4444" });
    await confirmed({ startAt: slot(3, "12:00") });
    const list = await manualMessagesDue();
    expect(list).toHaveLength(1);
    const m = list[0]!;
    expect(m).toMatchObject({ type: "confirmation", reference: phoneOnly.reference, name: "Bola Ade", phone: "0803 555 4444" });
    expect(m.whatsappUrl.startsWith("https://wa.me/2348035554444?text=")).toBe(true);
    expect(m.text).toMatch(/^Hello Bola Ade, your .* appointment at .* is confirmed/);
    const link = m.text.match(/https?:\/\/\S+\/booking\/\S+/)![0];
    expect(await findBookingByToken(phoneOnly.reference, new URL(link).searchParams.get("t")!)).not.toBeNull();
    expect(decodeURIComponent(m.whatsappUrl.split("?text=")[1]!)).toBe(m.text);
  });

  it("leaves the list once marked sent, recorded under the admin's name, and marking twice is harmless", async () => {
    const b = await confirmed({ email: "", noEmail: true });
    const [m] = await manualMessagesDue();
    await markWhatsappSent(m!.id, actor);
    await markWhatsappSent(m!.id, actor);
    expect(await manualMessagesDue()).toHaveLength(0);
    expect(await db.notification.findUniqueOrThrow({ where: { id: m!.id } })).toMatchObject({ status: "sent", providerMessageId: "whatsapp" });
    expect(await db.auditLog.count({ where: { bookingId: b.id, action: "notification.confirmation.whatsapp_sent", actorLabel: "Test admin" } })).toBe(1);
  });

  it("shows a reminder from the morning of the day it falls due", async () => {
    const b = await confirmed({ email: "", noEmail: true });
    const [confirmation] = await manualMessagesDue();
    await markWhatsappSent(confirmation!.id, actor);
    const dueDay = lagosDateKey(b.startAt.getTime() - 24 * HOUR);
    expect(await manualMessagesDue(lagosToUtcMs(dueDay, 0) - HOUR)).toHaveLength(0);
    const morning = await manualMessagesDue(lagosToUtcMs(dueDay, 8 * 60));
    expect(morning.map((m) => m.type)).toEqual(["reminder"]);
  });

  it("refuses an email that is still on its way normally", async () => {
    const b = await confirmed();
    const row = await db.notification.findUniqueOrThrow({ where: { dedupeKey: `confirmation:${b.id}` } });
    await expect(markWhatsappSent(row.id, actor)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect(await db.notification.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "pending", channel: "email" });
  });

  it("sends a failed or daily-limit email on WhatsApp instead, so it isn't emailed later", async () => {
    const a = await confirmed();
    const b = await confirmed({ startAt: slot(4, "12:00") });
    const failed = await db.notification.update({ where: { dedupeKey: `confirmation:${a.id}` }, data: { status: "failed", lastError: "Mailbox does not exist" } });
    const delayed = await db.notification.update({ where: { dedupeKey: `confirmation:${b.id}` }, data: { lastError: DAILY_LIMIT_NOTE, nextAttemptAt: new Date(Date.now() + HOUR) } });
    await markWhatsappSent(failed.id, actor);
    await markWhatsappSent(delayed.id, actor);
    for (const id of [failed.id, delayed.id]) {
      expect(await db.notification.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "sent", channel: "whatsapp_manual", providerMessageId: "whatsapp" });
    }
    expect(await db.auditLog.count({ where: { action: "notification.confirmation.whatsapp_sent", summary: { contains: "instead of email" } } })).toBe(2);
  });

  it("refuses a message that isn't for a booking", async () => {
    const row = await db.notification.create({ data: { dedupeKey: "alert:x", type: "owner_alert", channel: "email", dueAt: new Date() } });
    await expect(markWhatsappSent(row.id, actor)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
