import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings } from "../factories";
import { hmacHex } from "@/lib/crypto";
import { paid, paystack, SECRET, usePaystackFake } from "../fake-paystack";
import { createPendingBooking } from "@/server/booking-service";

/** Work the routes schedule to run after their response (sending due emails straight away). */
const afterQueue = vi.hoisted(() => [] as (() => Promise<void> | void)[]);
vi.mock("next/server", () => ({ connection: async () => {}, after: (fn: () => Promise<void> | void) => afterQueue.push(fn) }));

const { startBookingPayment, settlePayment } = await import("@/server/payments/checkout");
const { isValidSignature } = await import("@/server/payments/paystack");
const { POST: webhook } = await import("@/app/api/webhooks/paystack/route");

beforeEach(async () => {
  afterQueue.length = 0;
  usePaystackFake();
  await resetDatabase();
  await createSettings();
  await createServices();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function newBooking(overrides: Record<string, unknown> = {}) {
  const r = await createPendingBooking(bookingInput(overrides));
  return { ...r, booking: await db.booking.findUniqueOrThrow({ where: { reference: r.reference } }) };
}

async function signedWebhook(payload: unknown, opts: { secret?: string; ip?: string } = {}) {
  const raw = JSON.stringify(payload);
  const signature = await hmacHex("SHA-512", opts.secret ?? SECRET, raw);
  return webhook(
    new Request("http://localhost/api/webhooks/paystack", {
      method: "POST",
      body: raw,
      headers: { "x-paystack-signature": signature, "x-forwarded-for": opts.ip ?? "52.31.139.75", "content-type": "application/json" },
    }),
  );
}

describe("Paystack client", () => {
  it("accepts only a signature made with our secret over the exact body", async () => {
    const raw = JSON.stringify({ event: "charge.success", data: { reference: "x" } });
    expect(await isValidSignature(raw, await hmacHex("SHA-512", SECRET, raw))).toBe(true);
    expect(await isValidSignature(raw, await hmacHex("SHA-512", "sk_test_other", raw))).toBe(false);
    expect(await isValidSignature(raw + " ", await hmacHex("SHA-512", SECRET, raw))).toBe(false);
    expect(await isValidSignature(raw, null)).toBe(false);
  });

  it("charges the deposit worked out on the server, under our own reference", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const started = await startBookingPayment(reference, accessToken, "deposit");
    expect(started.amountKobo).toBe(booking.depositDueKobo);
    expect(started.reference).toMatch(new RegExp(`^${reference}-D-[A-Z0-9]{6}$`));
    expect(started.accessCode).toBe(`ac_${started.reference}`);
    expect(paystack.initialized[0]).toMatchObject({ reference: started.reference, amount: booking.depositDueKobo, currency: "NGN", email: booking.contactEmail });
  });

  it("sends the generated email for a phone-only customer", async () => {
    const { reference, accessToken } = await newBooking({ email: "", noEmail: true, phone: "0803 555 4444" });
    await startBookingPayment(reference, accessToken, "deposit");
    expect(paystack.initialized[0]!.email).toBe("2348035554444@noemail.example.com");
  });

  it("opens a fresh transaction on every press", async () => {
    const { reference, accessToken } = await newBooking();
    const a = await startBookingPayment(reference, accessToken, "deposit");
    const b = await startBookingPayment(reference, accessToken, "deposit");
    expect(a.reference).not.toBe(b.reference);
    expect(await db.paymentAttempt.count()).toBe(2);
  });

  it("refuses without the booking's token, and after the hold ends", async () => {
    const { reference, accessToken, booking } = await newBooking();
    await expect(startBookingPayment(reference, "wrong-token-123", "deposit")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    await expect(startBookingPayment(reference, accessToken, "deposit")).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
  });

  it("says payment is unavailable when Paystack can't be reached, and keeps the booking", async () => {
    const { reference, accessToken, booking } = await newBooking();
    paystack.down = true;
    await expect(startBookingPayment(reference, accessToken, "deposit")).rejects.toMatchObject({ code: "PAYMENT_UNAVAILABLE" });
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("pending_payment");
  });
});

describe("settling a payment", () => {
  it("records nothing until Paystack's Verify says success", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    expect(await settlePayment(ref, "Paystack")).toBe("pending");
    paystack.verify.set(ref, { status: "failed" });
    expect(await settlePayment(ref, "Paystack")).toBe("failed");
    expect(await db.payment.count()).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("pending_payment");
  });

  it("confirms the booking once, even when the webhook and the browser both report it at the same moment", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref, { channel: "bank_transfer" });
    const outcomes = await Promise.all([settlePayment(ref, "Paystack"), settlePayment(ref, "Paystack"), settlePayment(ref, "Paystack")]);
    expect(outcomes).toEqual(["paid", "paid", "paid"]);
    const payments = await db.payment.findMany();
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ type: "deposit", method: "transfer", amountKobo: booking.depositDueKobo, paystackReference: ref });
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("confirmed");
    expect(await db.notification.count({ where: { bookingId: booking.id } })).toBeGreaterThan(0);
  });

  it("a late payment confirms if the time is still free", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    await db.booking.update({ where: { id: booking.id }, data: { status: "expired", holdExpiresAt: null } });
    paid(ref);
    expect(await settlePayment(ref, "Paystack")).toBe("paid");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("confirmed");
  });

  it("a late payment for a time someone else took needs the owner's attention", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    await db.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
    await newBooking(); // takes the same (only) place
    paid(ref);
    expect(await settlePayment(ref, "Paystack")).toBe("paid");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("needs_attention");
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it("records a short deposit as received but leaves the booking for the owner", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref, { amount: booking.depositDueKobo - 100_000 });
    await settlePayment(ref, "Paystack");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("needs_attention");
    expect((await db.payment.findFirstOrThrow()).amountKobo).toBe(booking.depositDueKobo - 100_000);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "payment.deposit.received" } });
    expect(log.summary).toContain("less than the deposit asked");
  });

  it("never counts Paystack's fee toward the booking when the customer pays it", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref, { customerFee: 3046 });
    expect(await settlePayment(ref, "Paystack")).toBe("paid");
    const payment = await db.payment.findFirstOrThrow();
    expect(payment).toMatchObject({ amountKobo: booking.depositDueKobo, customerFeeKobo: 3046, paystackFeeKobo: 3046 });
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("confirmed");
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "payment.deposit.received" } });
    expect(log.summary).toContain("transaction fee paid by the customer");
    expect(log.summary).not.toContain("more than asked");
  });

  it("records Paystack's fee without touching the amount when the salon bears it", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref, { fees: 3000 });
    await settlePayment(ref, "Paystack");
    expect(await db.payment.findFirstOrThrow()).toMatchObject({ amountKobo: booking.depositDueKobo, customerFeeKobo: 0, paystackFeeKobo: 3000 });
  });

  it("refuses a charge Paystack says was for a different amount than we asked", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref, { requested: booking.depositDueKobo - 1, amount: booking.depositDueKobo - 1 });
    await expect(settlePayment(ref, "Paystack")).rejects.toThrow(/asked for/);
    expect(await db.payment.count()).toBe(0);
  });

  it("refuses a charge in another currency", async () => {
    const { reference, accessToken } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref, { currency: "USD" });
    await expect(settlePayment(ref, "Paystack")).rejects.toThrow(/USD/);
    expect(await db.payment.count()).toBe(0);
  });

  it("knows nothing about a reference we never issued", async () => {
    expect(await settlePayment("HC-NOPE1-D-AAAAAA", "Paystack")).toBe("unknown");
  });
});

describe("webhook", () => {
  it("refuses a bad signature, records the attempt and changes nothing", async () => {
    const { reference, accessToken } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref);
    const res = await signedWebhook({ event: "charge.success", data: { reference: ref } }, { secret: "sk_test_attacker" });
    expect(res.status).toBe(401);
    expect(await db.payment.count()).toBe(0);
    expect(await db.webhookEvent.findFirstOrThrow()).toMatchObject({ signatureValid: false, status: "ignored" });
  });

  it("never takes the event's word: a signed success that Verify doesn't confirm is retried, not recorded", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    // Correctly signed, but Paystack's Verify doesn't show the charge as successful yet.
    const res = await signedWebhook({ event: "charge.success", data: { reference: ref, amount: booking.depositDueKobo, status: "success" } });
    expect(res.status).toBe(500);
    expect((await db.webhookEvent.findFirstOrThrow()).status).toBe("failed");
    expect(await db.payment.count()).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("pending_payment");
  });

  it("confirms on charge.success, and a repeated event adds nothing", async () => {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref);
    const event = { event: "charge.success", data: { reference: ref } };
    expect((await signedWebhook(event)).status).toBe(200);
    expect((await signedWebhook(event)).status).toBe(200);
    expect(await db.payment.count()).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("confirmed");
    expect(await db.webhookEvent.count({ where: { status: "processed" } })).toBe(2);
  });

  it("sends the confirmation email straight after a paid webhook, without waiting for the hourly run", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "console");
    vi.stubEnv("AUTH_SECRET", "test-auth-secret-of-a-decent-length");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref);
    expect((await signedWebhook({ event: "charge.success", data: { reference: ref } })).status).toBe(200);
    expect(afterQueue).toHaveLength(1);
    for (const run of afterQueue.splice(0)) await run();
    expect(await db.notification.findUniqueOrThrow({ where: { dedupeKey: `confirmation:${booking.id}` } })).toMatchObject({ status: "sent" });
    // An event that confirms nothing schedules nothing.
    expect((await signedWebhook({ event: "charge.success", data: { reference: "HC-ZZZZZ-D-AAAAAA" } })).status).toBe(200);
    expect(afterQueue).toHaveLength(0);
  });

  it("handles events in any order: the browser settles first, the webhook arrives later", async () => {
    const { reference, accessToken } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref);
    await settlePayment(ref, "Paystack");
    expect((await signedWebhook({ event: "charge.success", data: { reference: ref } })).status).toBe(200);
    expect(await db.payment.count()).toBe(1);
  });

  it("ignores other events and unknown references", async () => {
    expect((await signedWebhook({ event: "transfer.success", data: { reference: "x" } })).status).toBe(200);
    expect((await signedWebhook({ event: "charge.success", data: { reference: "HC-ZZZZZ-D-AAAAAA" } })).status).toBe(200);
    expect(await db.webhookEvent.count({ where: { status: "ignored" } })).toBe(2);
  });

  it("logs, but doesn't block, a sender outside Paystack's addresses", async () => {
    const { reference, accessToken } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref);
    expect((await signedWebhook({ event: "charge.success", data: { reference: ref } }, { ip: "203.0.113.9" })).status).toBe(200);
    expect(await db.payment.count()).toBe(1);
    expect((await db.webhookEvent.findFirstOrThrow()).error).toMatch(/outside Paystack/);
  });

  it("then records it when Paystack sends the event again", async () => {
    const { reference, accessToken } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    const event = { event: "charge.success", data: { reference: ref } };
    expect((await signedWebhook(event)).status).toBe(500);
    paid(ref);
    expect((await signedWebhook(event)).status).toBe(200);
    expect(await db.payment.count()).toBe(1);
  });

  it("refuses a large body without storing it", async () => {
    const res = await webhook(new Request("http://localhost/api/webhooks/paystack", { method: "POST", body: "x".repeat(70 * 1024) }));
    expect(res.status).toBe(413);
    expect(await db.webhookEvent.count()).toBe(0);
  });

  it("stores only a short note of badly signed calls, and stops storing them from a flooding sender", async () => {
    const bad = () => signedWebhook({ event: "charge.success", data: { reference: "x", junk: "y".repeat(20_000) } }, { secret: "sk_test_attacker", ip: "203.0.113.50" });
    for (let i = 0; i < 22; i++) expect((await bad()).status).toBe(401);
    expect(await db.webhookEvent.count()).toBe(20);
    const stored = await db.webhookEvent.findFirstOrThrow();
    expect(JSON.stringify(stored.payload).length).toBeLessThan(2_100);
  });

  it("answers 500 when Paystack can't be reached, so Paystack retries", async () => {
    const { reference, accessToken } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paystack.down = true;
    expect((await signedWebhook({ event: "charge.success", data: { reference: ref } })).status).toBe(500);
    expect((await db.webhookEvent.findFirstOrThrow()).status).toBe("failed");
  });
});
