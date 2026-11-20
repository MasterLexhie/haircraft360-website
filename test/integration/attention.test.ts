import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings, slot } from "../factories";
import { developerContactLink, schedulerStale } from "@/domain/attention";

vi.mock("next/server", () => ({ connection: async () => {} }));

const { createPendingBooking, recordManualPayment } = await import("@/server/booking-service");
const { getAttention, attentionCount } = await import("@/server/attention");
const { DAILY_LIMIT_NOTE } = await import("@/server/notifications");

const actor = { id: null, label: "Test admin" };
const HOUR = 3_600_000;

beforeEach(async () => {
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-of-a-decent-length");
  vi.stubEnv("DEVELOPER_CONTACT_WHATSAPP", "+2348030000000");
  await resetDatabase();
  await createSettings();
  await createServices();
  await db.settings.update({ where: { id: 1 }, data: { schedulerHeartbeat: new Date() } });
});

afterEach(() => vi.unstubAllEnvs());

async function confirmed(overrides: Record<string, unknown> = {}) {
  const r = await createPendingBooking(bookingInput(overrides));
  const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
  await recordManualPayment(b.id, { amountKobo: b.depositDueKobo, method: "cash", note: "", purpose: "deposit" }, actor);
  return db.booking.findUniqueOrThrow({ where: { id: b.id } });
}

describe("Needs your attention", () => {
  it("is empty when everything is fine, including a message still retrying", async () => {
    const b = await confirmed();
    await db.notification.update({ where: { dedupeKey: `confirmation:${b.id}` }, data: { attempts: 1, lastError: "Timeout", nextAttemptAt: new Date(Date.now() + HOUR) } });
    expect(attentionCount(await getAttention())).toBe(0);
  });

  it("shows an email that failed after its retries, with a WhatsApp message ready", async () => {
    const b = await confirmed({ name: "Kemi Bello", phone: "0803 555 1212" });
    await db.notification.update({ where: { dedupeKey: `confirmation:${b.id}` }, data: { status: "failed", attempts: 4, lastError: "Mailbox does not exist" } });
    const a = await getAttention();
    expect(a.unreachable).toHaveLength(1);
    expect(a.unreachable[0]).toMatchObject({ reference: b.reference, name: "Kemi Bello", type: "confirmation" });
    expect(a.unreachable[0]!.whatsappUrl.startsWith("https://wa.me/2348035551212?text=")).toBe(true);
  });

  it("drops a failed email once the booking is cancelled or past", async () => {
    const b = await confirmed();
    await db.notification.update({ where: { dedupeKey: `confirmation:${b.id}` }, data: { status: "failed" } });
    await db.booking.update({ where: { id: b.id }, data: { status: "cancelled" } });
    expect((await getAttention()).unreachable).toHaveLength(0);
  });

  it("counts WhatsApp messages due today for customers without email", async () => {
    await confirmed({ email: "", noEmail: true });
    expect((await getAttention()).whatsappDue).toBe(1);
  });

  it("shows reminders held back by the daily email limit", async () => {
    const b = await confirmed();
    await db.notification.update({ where: { dedupeKey: `confirmation:${b.id}` }, data: { lastError: DAILY_LIMIT_NOTE, nextAttemptAt: new Date(Date.now() + 5 * HOUR) } });
    expect((await getAttention()).delayed.map((m) => m.reference)).toEqual([b.reference]);
  });

  it("shows a booking paid after its time was taken", async () => {
    const b = await confirmed();
    await db.booking.update({ where: { id: b.id }, data: { status: "needs_attention" } });
    expect((await getAttention()).newTimeNeeded.map((x) => x.reference)).toEqual([b.reference]);
  });

  it("shows ended appointments still to mark completed", async () => {
    const b = await confirmed({ startAt: slot(1, "10:00") });
    const later = b.endAt.getTime() + HOUR;
    expect((await getAttention(later)).toComplete.map((x) => x.reference)).toEqual([b.reference]);
  });

  it("says reminders aren't running when the scheduler hasn't run for two hours, with a developer link", async () => {
    expect((await getAttention()).scheduler.stopped).toBe(false);
    await db.settings.update({ where: { id: 1 }, data: { schedulerHeartbeat: new Date(Date.now() - 2 * HOUR - 60_000) } });
    const a = await getAttention();
    expect(a.scheduler.stopped).toBe(true);
    expect(a.scheduler.developerUrl).toMatch(/^https:\/\/wa\.me\/2348030000000\?text=/);
    expect(decodeURIComponent(a.scheduler.developerUrl!)).toContain("Reminders aren't running");
  });

  it("shows a system error with its reference for the developer", async () => {
    const w = await db.webhookEvent.create({ data: { eventType: "charge.success", payload: {}, signatureValid: true, status: "failed", error: "boom" } });
    const a = await getAttention();
    expect(a.systemErrors.problems.map((p) => p.reference)).toEqual([w.id]);
    expect(decodeURIComponent(a.systemErrors.developerUrl!)).toContain(w.id);
  });
});

describe("attention rules", () => {
  it("treats a missing heartbeat as stopped", () => {
    expect(schedulerStale(null, Date.now())).toBe(true);
    expect(schedulerStale(new Date(Date.now() - HOUR).toISOString(), Date.now())).toBe(false);
  });

  it("gives no developer link without a usable number", () => {
    expect(developerContactLink(undefined, "Salon", "x", "ref")).toBeNull();
    expect(developerContactLink("", "Salon", "x", "ref")).toBeNull();
    expect(developerContactLink("+234 803 000 0000", "Salon", "Problem", "abc")).toBe(`https://wa.me/2348030000000?text=${encodeURIComponent('Hello, the Salon admin shows: "Problem". Reference: abc')}`);
  });
});
