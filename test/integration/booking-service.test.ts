import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings, slot } from "../factories";
import { BookingError, createPendingBooking, recordManualPayment, recordOnlinePayment, setBookingStatus } from "@/server/booking-service";
import { getCustomerBooking } from "@/server/queries";

// next/server's connection() needs a request; tests call queries directly.
import { vi } from "vitest";
vi.mock("next/server", () => ({ connection: async () => {} }));

const actor = { id: null, label: "Test admin" };

beforeEach(async () => {
  await resetDatabase();
  await createSettings();
  await createServices();
});

async function confirm(reference: string, paystackReference = `ref_${reference}`) {
  const b = await db.booking.findUniqueOrThrow({ where: { reference } });
  return db.$transaction((tx) =>
    recordOnlinePayment(tx, b.id, { type: "deposit", method: "card", amountKobo: b.depositDueKobo, paystackReference, actorLabel: "Test" }),
  );
}

describe("createPendingBooking", () => {
  it("prices the booking on the server from the service and add-ons", async () => {
    const r = await createPendingBooking(bookingInput({ addOnIds: ["svc_wash"] }));
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference }, include: { items: true } });
    expect(b.totalKobo).toBe(1_800_000);
    expect(b.depositDueKobo).toBe(540_000);
    expect(b.endAt.getTime() - b.startAt.getTime()).toBe(150 * 60_000);
    expect(b.items.map((i) => [i.kind, i.priceKobo])).toEqual(expect.arrayContaining([["main", 1_500_000], ["add_on", 300_000]]));
    expect(b.status).toBe("pending_payment");
    expect(b.accessTokenHash).not.toBe(r.accessToken);
  });

  it("rejects an add-on the main service does not offer", async () => {
    await expect(createPendingBooking(bookingInput({ addOnIds: ["svc_other"] }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("requires an email unless the customer has none, then uses a placeholder", async () => {
    await expect(createPendingBooking(bookingInput({ email: "" }))).rejects.toMatchObject({ code: "VALIDATION" });
    const r = await createPendingBooking(bookingInput({ email: "", noEmail: true, phone: "0803 555 9999" }));
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    expect(b.contactEmail).toBeNull();
    const email = await db.customerEmail.findFirstOrThrow({ where: { customerId: b.customerId } });
    expect(email).toMatchObject({ isPlaceholder: true, value: "2348035559999@noemail.localhost" });
  });

  it("refuses a time that is already at capacity", async () => {
    await createPendingBooking(bookingInput());
    await expect(createPendingBooking(bookingInput())).rejects.toMatchObject({ code: "SLOT_TAKEN" });
  });

  it("lets only one of two simultaneous requests take the last place", async () => {
    const results = await Promise.allSettled([createPendingBooking(bookingInput()), createPendingBooking(bookingInput())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BookingError);
    expect(rejected.reason.code).toBe("SLOT_TAKEN");
  });

  it("refuses a time the salon has closed with a Block", async () => {
    await db.block.create({ data: { startAt: new Date(slot(3, "09:00")), endAt: new Date(slot(3, "13:00")), reason: "Training" } });
    await expect(createPendingBooking(bookingInput())).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    await expect(createPendingBooking(bookingInput({ startAt: slot(3, "13:00") }))).resolves.toMatchObject({ reference: expect.any(String) });
  });

  it("allows one active unpaid hold per phone number", async () => {
    const input = bookingInput();
    await createPendingBooking(input);
    await expect(createPendingBooking({ ...input, startAt: slot(4, "10:00") })).rejects.toMatchObject({ code: "TOO_MANY_HOLDS" });
  });
});

describe("customer matching", () => {
  it("matches a returning customer by phone in any format and keeps every typed name", async () => {
    const a = await createPendingBooking(bookingInput({ phone: "08035550001", name: "Ada Okafor" }));
    await confirm(a.reference);
    const b = await createPendingBooking(bookingInput({ phone: "+234 803 555 0001", name: "Adaeze Okafor", startAt: slot(5, "10:00") }));
    const [ba, bb] = await Promise.all([
      db.booking.findUniqueOrThrow({ where: { reference: a.reference } }),
      db.booking.findUniqueOrThrow({ where: { reference: b.reference } }),
    ]);
    expect(bb.customerId).toBe(ba.customerId);
    const names = await db.customerNameVariant.findMany({ where: { customerId: ba.customerId } });
    expect(names.map((n) => n.name).sort()).toEqual(["Ada Okafor", "Adaeze Okafor"]);
  });

  it("matches by email when the phone is new, and adds the phone", async () => {
    const a = await createPendingBooking(bookingInput({ phone: "08035550002", email: "same@example.com" }));
    await confirm(a.reference);
    const b = await createPendingBooking(bookingInput({ phone: "08035550003", email: "Same@Example.com", startAt: slot(5, "10:00") }));
    const bb = await db.booking.findUniqueOrThrow({ where: { reference: b.reference } });
    const phones = await db.customerPhone.findMany({ where: { customerId: bb.customerId } });
    expect(phones.map((p) => p.e164).sort()).toEqual(["+2348035550002", "+2348035550003"]);
  });

  it("keeps two customers apart when the phone and the email point at different people", async () => {
    const a = await createPendingBooking(bookingInput({ phone: "08035550010", email: "a@example.com" }));
    await confirm(a.reference);
    const b = await createPendingBooking(bookingInput({ phone: "08035550011", email: "b@example.com", startAt: slot(5, "10:00") }));
    await confirm(b.reference);
    const c = await createPendingBooking(bookingInput({ phone: "08035550010", email: "b@example.com", startAt: slot(6, "10:00") }));
    const [ba, bb, bc] = await Promise.all([a, b, c].map((x) => db.booking.findUniqueOrThrow({ where: { reference: x.reference } })));
    expect(bc.customerId).toBe(ba.customerId);
    expect(await db.customerEmail.findUniqueOrThrow({ where: { value: "b@example.com" } })).toMatchObject({ customerId: bb.customerId });
    const log = await db.auditLog.findFirstOrThrow({ where: { bookingId: bc.id, action: "booking.created" } });
    expect(log.summary).toMatch(/possible duplicate/);
  });

  it("never shows the stored profile or other bookings on a new booking's page (F-01)", async () => {
    const first = await createPendingBooking(bookingInput({ phone: "08035550020", name: "Real Owner", email: "owner@example.com" }));
    await confirm(first.reference);
    const intruder = await createPendingBooking(bookingInput({ phone: "08035550020", name: "Someone Else", email: "else@example.com", startAt: slot(5, "10:00") }));
    const page = await getCustomerBooking(intruder.reference, intruder.accessToken);
    const json = JSON.stringify(page);
    expect(page?.booking.contactName).toBe("Someone Else");
    expect(json).not.toContain("Real Owner");
    expect(json).not.toContain("owner@example.com");
    expect(json).not.toContain(first.reference);
    expect(json).not.toContain(first.accessToken);
  });

  it("refuses the booking page without the right token", async () => {
    const r = await createPendingBooking(bookingInput());
    expect(await getCustomerBooking(r.reference, undefined)).toBeNull();
    expect(await getCustomerBooking(r.reference, "wrong")).toBeNull();
    expect(await getCustomerBooking(r.reference, r.accessToken)).not.toBeNull();
  });
});

describe("recordOnlinePayment", () => {
  it("confirms the booking once, however many times the same payment arrives", async () => {
    const r = await createPendingBooking(bookingInput());
    const first = await confirm(r.reference, "dup_ref");
    const second = await confirm(r.reference, "dup_ref");
    expect(first).toMatchObject({ duplicate: false, status: "confirmed" });
    expect(second).toMatchObject({ duplicate: true });
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    expect(await db.payment.count({ where: { bookingId: b.id } })).toBe(1);
    expect(await db.notification.count({ where: { bookingId: b.id } })).toBe(2);
  });

  it("late payment confirms if the time is still free", async () => {
    const r = await createPendingBooking(bookingInput());
    await db.booking.update({ where: { reference: r.reference }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
    expect(await confirm(r.reference)).toMatchObject({ status: "confirmed" });
  });

  it("late payment lands in needs attention if the time was taken meanwhile", async () => {
    const late = await createPendingBooking(bookingInput());
    await db.booking.update({ where: { reference: late.reference }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
    const other = await createPendingBooking(bookingInput());
    await confirm(other.reference);
    expect(await confirm(late.reference)).toMatchObject({ status: "needs_attention" });
  });
});

describe("admin changes", () => {
  it("cannot reinstate a booking into a time that is now full", async () => {
    const a = await createPendingBooking(bookingInput());
    await confirm(a.reference);
    const ba = await db.booking.findUniqueOrThrow({ where: { reference: a.reference } });
    await setBookingStatus(ba.id, "cancelled", actor);
    const b = await createPendingBooking(bookingInput());
    await confirm(b.reference);
    await expect(setBookingStatus(ba.id, "confirmed", actor)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
  });

  it("cannot record a payment against an expired or cancelled booking", async () => {
    const r = await createPendingBooking(bookingInput());
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    await setBookingStatus(b.id, "cancelled", actor);
    await expect(recordManualPayment(b.id, { amountKobo: 100_000, method: "cash", note: "", towardsDeposit: false }, actor)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });

  it("a manual deposit confirms an unpaid booking", async () => {
    const r = await createPendingBooking(bookingInput());
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    await recordManualPayment(b.id, { amountKobo: b.depositDueKobo, method: "transfer", note: "", towardsDeposit: true }, actor);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("confirmed");
  });
});
