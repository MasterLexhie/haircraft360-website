import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings, slot } from "../factories";
import type { EmailMessage } from "@/server/email/transport";

const mail = vi.hoisted(() => ({
  sent: [] as { msg: EmailMessage; key: string }[],
  /** Errors to throw, one per send, before sending normally again. */
  failures: [] as Error[],
}));

vi.mock("@/server/email/transport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/email/transport")>();
  return {
    ...actual,
    sendEmail: vi.fn(async (msg: EmailMessage, key: string) => {
      const failure = mail.failures.shift();
      if (failure) throw failure;
      mail.sent.push({ msg, key });
      return { id: `fake_${mail.sent.length}` };
    }),
  };
});
vi.mock("next/server", () => ({ connection: async () => {} }));

const { EmailSendError } = await import("@/server/email/transport");
const { createPendingBooking, moveBooking, recordManualPayment, setBookingStatus, findBookingByToken } = await import("@/server/booking-service");
const { runScheduler, sendDueNotifications, MAX_ATTEMPTS } = await import("@/server/notifications");
const { POST: cronRoute } = await import("@/app/api/cron/notifications/route");

const actor = { id: null, label: "Test admin" };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

beforeEach(async () => {
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-of-a-decent-length");
  vi.stubEnv("OWNER_NOTIFICATION_EMAIL", "owner@example.test");
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  mail.sent = [];
  mail.failures = [];
  await resetDatabase();
  await createSettings();
  await createServices();
});

afterEach(() => vi.unstubAllEnvs());

/** A booking confirmed by a cash deposit, which queues its confirmation and reminder. */
async function confirmedBooking(overrides: Record<string, unknown> = {}) {
  const r = await createPendingBooking(bookingInput(overrides));
  const booking = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
  await recordManualPayment(booking.id, { amountKobo: booking.depositDueKobo, method: "cash", note: "", purpose: "deposit" }, actor);
  return db.booking.findUniqueOrThrow({ where: { id: booking.id } });
}

const reminderOf = (bookingId: string) => db.notification.findUniqueOrThrow({ where: { dedupeKey: `reminder:${bookingId}` } });
const confirmationOf = (bookingId: string) => db.notification.findUniqueOrThrow({ where: { dedupeKey: `confirmation:${bookingId}` } });

describe("sending", () => {
  it("sends the confirmation once, with the calendar file and a working booking link, however often it runs", async () => {
    const b = await confirmedBooking();
    expect(await runScheduler()).toMatchObject({ sent: 1, failed: 0 });
    expect(await runScheduler()).toMatchObject({ sent: 0 });
    expect(mail.sent).toHaveLength(1);
    const { msg } = mail.sent[0]!;
    expect(msg.to).toBe(b.contactEmail);
    expect(msg.subject).toMatch(/^Booking confirmed/);
    expect(msg.attachments?.[0]).toMatchObject({ filename: `${b.reference}.ics` });
    const token = new URL(msg.text.match(/View your booking: (\S+)/)![1]!).searchParams.get("t")!;
    expect(await findBookingByToken(b.reference, token)).not.toBeNull();
    expect(await confirmationOf(b.id)).toMatchObject({ status: "sent", providerMessageId: "fake_1", attempts: 1 });
    expect((await db.settings.findUniqueOrThrow({ where: { id: 1 } })).schedulerHeartbeat).not.toBeNull();
  });

  it("sends the reminder a day before, once", async () => {
    const b = await confirmedBooking();
    await runScheduler();
    const dueAt = b.startAt.getTime() - DAY;
    expect(await sendDueNotifications({ nowMs: dueAt - HOUR })).toMatchObject({ sent: 0 });
    expect(await sendDueNotifications({ nowMs: dueAt + 60_000 })).toMatchObject({ sent: 1 });
    expect(await sendDueNotifications({ nowMs: dueAt + 2 * HOUR })).toMatchObject({ sent: 0 });
    expect(mail.sent.map((m) => m.msg.subject)).toEqual([expect.stringMatching(/^Booking confirmed/), expect.stringMatching(/^Reminder/)]);
  });

  it("never sends the same row twice when two runs overlap", async () => {
    await confirmedBooking();
    await confirmedBooking({ startAt: slot(3, "12:00") });
    const [a, b] = await Promise.all([runScheduler(), runScheduler()]);
    expect(a.sent + b.sent).toBe(2);
    expect(mail.sent).toHaveLength(2);
  });
});

describe("skip rules", () => {
  it("skips the reminder of a cancelled booking", async () => {
    const b = await confirmedBooking();
    await runScheduler();
    await setBookingStatus(b.id, "cancelled", actor);
    expect(await sendDueNotifications({ nowMs: b.startAt.getTime() - DAY + 60_000 })).toMatchObject({ sent: 0, skipped: 1 });
    expect(await reminderOf(b.id)).toMatchObject({ status: "skipped", lastError: "The booking is cancelled" });
  });

  it("sends one reminder for the new time after a move, even if the old one went out", async () => {
    const b = await confirmedBooking();
    await runScheduler();
    await sendDueNotifications({ nowMs: b.startAt.getTime() - DAY + 60_000 });
    expect(mail.sent).toHaveLength(2);
    const newStart = new Date(b.startAt.getTime() + 2 * DAY);
    await moveBooking(b.id, newStart.toISOString(), actor);
    expect(await reminderOf(b.id)).toMatchObject({ status: "pending", dueAt: new Date(newStart.getTime() - DAY) });
    expect(await sendDueNotifications({ nowMs: newStart.getTime() - DAY + 60_000 })).toMatchObject({ sent: 1 });
    expect(await sendDueNotifications({ nowMs: newStart.getTime() - DAY + 2 * HOUR })).toMatchObject({ sent: 0 });
    // A different key from the first reminder, so the provider doesn't drop it as a repeat.
    expect(mail.sent[2]!.key).not.toBe(mail.sent[1]!.key);
  });

  it("skips a reminder that would land right after the confirmation", async () => {
    const tomorrow = new Date(Date.now() + 20 * HOUR);
    tomorrow.setUTCMinutes(0, 0, 0);
    const b = await confirmedBooking({ startAt: tomorrow.toISOString() });
    const r = await runScheduler();
    expect(r).toMatchObject({ sent: 1, skipped: 1 });
    expect(await reminderOf(b.id)).toMatchObject({ status: "skipped", lastError: expect.stringContaining("confirmation covers it") });
  });

  it("takes WhatsApp rows off the list when the booking is cancelled", async () => {
    const b = await confirmedBooking({ email: "", noEmail: true });
    expect(await confirmationOf(b.id)).toMatchObject({ channel: "whatsapp_manual", status: "pending" });
    expect(await runScheduler()).toMatchObject({ sent: 0 });
    await setBookingStatus(b.id, "cancelled", actor);
    await runScheduler();
    expect(await confirmationOf(b.id)).toMatchObject({ status: "skipped" });
    expect(mail.sent).toHaveLength(0);
  });
});

describe("failures", () => {
  it("retries after 1, 3 and 9 hours, then gives up", async () => {
    const b = await confirmedBooking();
    let t = Date.now();
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      mail.failures.push(new EmailSendError("Resend 503", "temporary"));
      const r = await sendDueNotifications({ nowMs: t });
      const row = await confirmationOf(b.id);
      expect(row.attempts).toBe(attempt);
      if (attempt < MAX_ATTEMPTS) {
        expect(r.retrying).toBe(1);
        expect(row.status).toBe("pending");
        const wait = row.nextAttemptAt!.getTime() - Date.now();
        expect(Math.round(wait / HOUR)).toBe([1, 3, 9][attempt - 1]);
        expect(await sendDueNotifications({ nowMs: t + 30 * 60_000 })).toMatchObject({ sent: 0, retrying: 0 });
        t = row.nextAttemptAt!.getTime() + 1000;
      } else {
        expect(r.failed).toBe(1);
        expect(row).toMatchObject({ status: "failed", lastError: "Resend 503" });
      }
    }
    expect(mail.sent).toHaveLength(0);
  });

  it("gives up straight away on a message the provider refuses", async () => {
    const b = await confirmedBooking();
    mail.failures.push(new EmailSendError("Resend 422 invalid_parameter", "permanent"));
    expect(await runScheduler()).toMatchObject({ failed: 1 });
    expect(await confirmationOf(b.id)).toMatchObject({ status: "failed", attempts: 1 });
  });

  it("stops at the daily limit without using up an attempt, and holds the rest until the reset", async () => {
    const a = await confirmedBooking();
    const b = await confirmedBooking({ startAt: slot(3, "12:00") });
    mail.failures.push(new EmailSendError("Resend 429 daily_quota_exceeded", "daily_limit"));
    expect(await runScheduler()).toMatchObject({ sent: 0, stopped: "daily_limit" });
    for (const id of [a.id, b.id]) {
      const row = await confirmationOf(id);
      expect(row).toMatchObject({ status: "pending", attempts: 0, lastError: expect.stringContaining("Daily email limit") });
      expect(row.nextAttemptAt!.getUTCHours()).toBe(0);
    }
    expect(await runScheduler()).toMatchObject({ sent: 0 });
    expect(await sendDueNotifications({ nowMs: Date.now() + DAY })).toMatchObject({ sent: 2 });
  });
});

describe("owner alerts", () => {
  it("go to the owner's address", async () => {
    await db.notification.create({ data: { dedupeKey: "alert:test", type: "owner_alert", channel: "email", dueAt: new Date(), payload: { message: "New sign-in to the admin." } } });
    expect(await runScheduler()).toMatchObject({ sent: 1 });
    expect(mail.sent[0]!.msg).toMatchObject({ to: "owner@example.test", subject: expect.stringContaining("Security notice") });
    expect(mail.sent[0]!.msg.text).toContain("New sign-in to the admin.");
  });
});

describe("cron route", () => {
  const call = (auth?: string) => cronRoute(new Request("http://localhost/api/cron/notifications", { method: "POST", headers: auth ? { authorization: auth } : {} }));

  it("needs the secret, then answers with a one-line summary", async () => {
    await confirmedBooking();
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    const res = await call("Bearer test-cron-secret");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok sent=1 skipped=0 retrying=0 failed=0");
  });
});
