import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings } from "../factories";
import { paid, usePaystackFake } from "../fake-paystack";
import { BookingError, createPendingBooking, setBookingStatus } from "@/server/booking-service";

vi.mock("next/server", () => ({ connection: async () => {} }));

const actor = { id: null, label: "Test admin" };
const { startBookingPayment, settlePayment } = await import("@/server/payments/checkout");
const { createBalanceLink, getPaymentLinkView, startLinkPayment } = await import("@/server/payments/links");

beforeEach(async () => {
  usePaystackFake();
  await resetDatabase();
  await createSettings();
  await createServices();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function newBooking() {
  const r = await createPendingBooking(bookingInput());
  return { ...r, booking: await db.booking.findUniqueOrThrow({ where: { reference: r.reference } }) };
}

describe("balance links", () => {
  async function confirmedWithBalance() {
    const { reference, accessToken, booking } = await newBooking();
    const { reference: ref } = await startBookingPayment(reference, accessToken, "deposit");
    paid(ref);
    await settlePayment(ref, "Paystack");
    return booking;
  }

  it("shows the booking's own details and the balance, and works on two different days", async () => {
    const booking = await confirmedWithBalance();
    const { url, amountKobo } = await createBalanceLink(booking.id, actor);
    expect(amountKobo).toBe(booking.totalKobo - booking.depositDueKobo);
    const token = url.split("/pay/")[1]!;
    expect(await getPaymentLinkView(token)).toMatchObject({ reference: booking.reference, contactName: booking.contactName, dueKobo: amountKobo });

    const first = await startLinkPayment(token);
    const second = await startLinkPayment(token);
    expect(first.reference).not.toBe(second.reference);
    expect(first.amountKobo).toBe(amountKobo);

    paid(second.reference);
    expect(await settlePayment(second.reference, "Paystack")).toBe("paid");
    expect((await getPaymentLinkView(token))!.dueKobo).toBe(0);
    expect((await db.paymentLink.findFirstOrThrow()).usedAt).not.toBeNull();
    await expect(startLinkPayment(token)).rejects.toMatchObject({ code: "NOTHING_DUE" });
  });

  it("stores only the token's hash, and stops working once expired", async () => {
    const booking = await confirmedWithBalance();
    const { url } = await createBalanceLink(booking.id, actor);
    const token = url.split("/pay/")[1]!;
    const link = await db.paymentLink.findFirstOrThrow();
    expect(link.tokenHash).not.toContain(token);
    await db.paymentLink.update({ where: { id: link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getPaymentLinkView(token)).toBeNull();
    await expect(startLinkPayment(token)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("can't be made for an unpaid or cancelled booking", async () => {
    const { booking } = await newBooking();
    await expect(createBalanceLink(booking.id, actor)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await setBookingStatus(booking.id, "cancelled", actor);
    await expect(createBalanceLink(booking.id, actor)).rejects.toBeInstanceOf(BookingError);
  });
});
