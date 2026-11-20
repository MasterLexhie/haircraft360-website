import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings, slot } from "../factories";

vi.mock("next/server", () => ({ connection: async () => {} }));

const { createPendingBooking, recordManualPayment, setBookingStatus, completeBooking, updateBookingEmail } = await import("@/server/booking-service");
const { bookingMessages, balanceLinkWhatsapp } = await import("@/server/whatsapp-messages");

const actor = { id: null, label: "Test admin" };
const HOUR = 3_600_000;

beforeEach(async () => {
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-of-a-decent-length");
  await resetDatabase();
  await createSettings();
  await createServices();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function confirmed(overrides: Record<string, unknown> = {}) {
  const r = await createPendingBooking(bookingInput(overrides));
  const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
  await recordManualPayment(b.id, { amountKobo: b.depositDueKobo, method: "cash", note: "", purpose: "deposit" }, actor);
  return db.booking.findUniqueOrThrow({ where: { id: b.id } });
}

describe("completing and no-shows", () => {
  it("waits until the appointment has started", async () => {
    const b = await confirmed();
    await expect(setBookingStatus(b.id, "no_show", actor)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await expect(completeBooking(b.id, { extras: [] }, actor)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    vi.useFakeTimers({ toFake: ["Date"], now: b.startAt.getTime() + HOUR });
    await setBookingStatus(b.id, "no_show", actor);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("no_show");
  });

  it("adds items on the day, which raises the total and the balance", async () => {
    const b = await confirmed();
    vi.useFakeTimers({ toFake: ["Date"], now: b.endAt.getTime() });
    const { balanceDueKobo } = await completeBooking(b.id, { extras: [{ name: "Loc oil", priceKobo: 250_000, note: "" }] }, actor);
    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after).toMatchObject({ status: "completed", totalKobo: b.totalKobo + 250_000 });
    expect(balanceDueKobo).toBe(b.totalKobo + 250_000 - b.depositDueKobo);
  });
});

describe("Messages on the booking page", () => {
  it("labels each message and offers WhatsApp once an email has failed", async () => {
    const b = await confirmed();
    let view = await bookingMessages(b.id);
    expect(view.messages.map((m) => m.status.label)).toEqual(["Confirmation not sent yet", expect.stringMatching(/^Reminder goes out by email /)]);
    expect(view.whatsapp?.confirmation).toMatch(/^https:\/\/wa\.me\//);
    await db.notification.update({ where: { dedupeKey: `confirmation:${b.id}` }, data: { status: "failed" } });
    view = await bookingMessages(b.id);
    expect(view.messages[0]).toMatchObject({ status: { label: "Couldn't reach this customer by email", fixEmail: true } });
    expect(view.messages[0]!.manual?.whatsappUrl).toMatch(/^https:\/\/wa\.me\//);
  });

  it("offers no WhatsApp sending once the booking is cancelled", async () => {
    const b = await confirmed();
    await setBookingStatus(b.id, "cancelled", actor);
    expect((await bookingMessages(b.id)).whatsapp).toBeNull();
  });

  it("fills the balance link message with the owner's wording and the link", async () => {
    const b = await confirmed();
    const url = await balanceLinkWhatsapp(b.id, "https://example.test/pay/abc");
    expect(decodeURIComponent(url.split("?text=")[1]!)).toMatch(/Your balance is ₦.*https:\/\/example\.test\/pay\/abc$/);
  });
});

describe("fixing the email", () => {
  it("sends a failed confirmation again to the new address and records the change", async () => {
    const b = await confirmed({ email: "wrong@exmaple.com" });
    await db.notification.update({ where: { dedupeKey: `confirmation:${b.id}` }, data: { status: "failed", attempts: 4, lastError: "Mailbox does not exist" } });
    const { resent } = await updateBookingEmail(b.id, "  Right@Example.com ", actor);
    expect(resent).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).contactEmail).toBe("right@example.com");
    expect(await db.notification.findUniqueOrThrow({ where: { dedupeKey: `confirmation:${b.id}` } })).toMatchObject({ status: "pending", channel: "email", attempts: 0, lastError: null });
    expect(await db.customerEmail.count({ where: { customerId: b.customerId, value: "right@example.com" } })).toBe(1);
    expect(await db.auditLog.count({ where: { bookingId: b.id, action: "booking.email_changed", summary: { contains: "wrong@exmaple.com to right@example.com" } } })).toBe(1);
  });

  it("moves a phone-only customer's waiting messages to email", async () => {
    const b = await confirmed({ email: "", noEmail: true });
    await updateBookingEmail(b.id, "bola@example.com", actor);
    const rows = await db.notification.findMany({ where: { bookingId: b.id } });
    expect(rows.map((r) => r.channel)).toEqual(["email", "email"]);
  });

  it("refuses an address that isn't an email", async () => {
    const b = await confirmed();
    await expect(updateBookingEmail(b.id, "not-an-email", actor)).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { email: expect.any(String) } });
  });

  it("doesn't take an address from another customer's record", async () => {
    const other = await confirmed({ email: "shared@example.com", startAt: slot(4, "10:00") });
    const b = await confirmed();
    await updateBookingEmail(b.id, "shared@example.com", actor);
    expect((await db.customerEmail.findUniqueOrThrow({ where: { value: "shared@example.com" } })).customerId).toBe(other.customerId);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).contactEmail).toBe("shared@example.com");
  });
});
