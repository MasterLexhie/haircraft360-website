import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings } from "../factories";
import { usePaystackFake } from "../fake-paystack";
import { createPendingBooking, findBookingByToken } from "@/server/booking-service";
import { ensureMessageToken } from "@/server/booking-access";

const { startBookingPayment } = await import("@/server/payments/checkout");

beforeEach(async () => {
  usePaystackFake();
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-of-a-decent-length");
  await resetDatabase();
  await createSettings();
  await createServices();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("message links", () => {
  it("open the booking like the customer's own link, with only a hash stored", async () => {
    const { reference, accessToken } = await createPendingBooking(bookingInput());
    const booking = await db.booking.findUniqueOrThrow({ where: { reference } });
    const token = await ensureMessageToken(booking);
    expect(token).not.toBe(accessToken);
    expect(await ensureMessageToken(booking)).toBe(token);
    const stored = await db.booking.findUniqueOrThrow({ where: { reference } });
    expect(stored.messageTokenHash).toBeTruthy();
    expect(stored.messageTokenHash).not.toContain(token);
    expect(await findBookingByToken(reference, token)).not.toBeNull();
    expect(await findBookingByToken(reference, accessToken)).not.toBeNull();
    await expect(startBookingPayment(reference, token, "deposit")).resolves.toMatchObject({ reference: expect.stringContaining(reference) });
  });

  it("are the same on every send, so a retried message carries the same link", async () => {
    const { reference } = await createPendingBooking(bookingInput());
    const booking = await db.booking.findUniqueOrThrow({ where: { reference } });
    const fresh = await db.booking.findUniqueOrThrow({ where: { reference } });
    expect(await ensureMessageToken(booking)).toBe(await ensureMessageToken(fresh));
  });

  it("stop working when the link expires, and other tokens never open it", async () => {
    const { reference } = await createPendingBooking(bookingInput());
    const booking = await db.booking.findUniqueOrThrow({ where: { reference } });
    const token = await ensureMessageToken(booking);
    expect(await findBookingByToken(reference, "made-up-token")).toBeNull();
    await db.booking.update({ where: { reference }, data: { accessExpiresAt: new Date(Date.now() - 1000) } });
    expect(await findBookingByToken(reference, token)).toBeNull();
  });
});
