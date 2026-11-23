import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "../db";
import { bookingInput, createServices, createSettings, slot, webpBytes } from "../factories";
import { BookingError, createBlock, createPendingBooking, deleteBlock, moveBooking, recordManualPayment, recordOnlinePayment, setBookingStatus, setMarketingConsent, updateCustomerTags, upsertService, type ServiceInput } from "@/server/booking-service";
import { findBookingSummary, getCustomerBooking } from "@/server/queries";

// next/server's connection() needs a request; tests call queries directly.
import { vi } from "vitest";
vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));

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
    expect(email).toMatchObject({ isPlaceholder: true, value: "2348035559999@noemail.example.com" });
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
  it("Find my booking needs the booking's own phone or email and shows only date, time, status and balance (D6)", async () => {
    const r = await createPendingBooking(bookingInput({ phone: "08035550030", email: "finder@example.com" }));
    const ref = r.reference.toLowerCase();
    const byPhone = await findBookingSummary(ref, "+234 803 555 0030");
    expect(byPhone && Object.keys(byPhone).sort()).toEqual(["balanceKobo", "endAt", "reference", "startAt", "status"]);
    expect(await findBookingSummary(ref, "FINDER@example.com")).not.toBeNull();
    expect(await findBookingSummary(ref, "08035550031")).toBeNull();
    expect(await findBookingSummary(ref, "someone@example.com")).toBeNull();
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
    await expect(recordManualPayment(b.id, { amountKobo: 100_000, method: "cash", note: "", purpose: "balance" }, actor)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });

  it("a manual deposit confirms an unpaid booking", async () => {
    const r = await createPendingBooking(bookingInput());
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    await recordManualPayment(b.id, { amountKobo: b.depositDueKobo, method: "transfer", note: "", purpose: "deposit" }, actor);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("confirmed");
  });

  it("cannot reinstate over a live unpaid hold that fills the time", async () => {
    const a = await createPendingBooking(bookingInput());
    await confirm(a.reference);
    const ba = await db.booking.findUniqueOrThrow({ where: { reference: a.reference } });
    await setBookingStatus(ba.id, "cancelled", actor);
    await createPendingBooking(bookingInput()); // someone else is now paying for this time
    await expect(setBookingStatus(ba.id, "confirmed", actor)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
  });
});

describe("moving a booking", () => {
  async function needsAttention() {
    const late = await createPendingBooking(bookingInput());
    await db.booking.update({ where: { reference: late.reference }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
    const other = await createPendingBooking(bookingInput());
    await confirm(other.reference);
    await confirm(late.reference);
    return db.booking.findUniqueOrThrow({ where: { reference: late.reference } });
  }

  it("confirms a paid booking that needed a new time once it is moved to a free time, and schedules its messages", async () => {
    const b = await needsAttention();
    expect(b.status).toBe("needs_attention");
    await expect(moveBooking(b.id, slot(3, "14:00"), actor)).resolves.toEqual({ status: "confirmed", confirmedByMove: true });
    const moved = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(moved.status).toBe("confirmed");
    expect(moved.startAt.toISOString()).toBe(slot(3, "14:00"));
    expect(moved.endAt.getTime() - moved.startAt.getTime()).toBe(b.endAt.getTime() - b.startAt.getTime());
    const reminder = await db.notification.findUniqueOrThrow({ where: { dedupeKey: `reminder:${b.id}` } });
    expect(reminder.dueAt.getTime()).toBe(moved.startAt.getTime() - 86_400_000);
  });

  it("refuses a time that is full, and leaves the booking where it was", async () => {
    const b = await needsAttention();
    await expect(moveBooking(b.id, slot(3, "10:00"), actor)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("needs_attention");
  });

  it("moves a confirmed booking and sends its reminder again for the new time", async () => {
    const r = await createPendingBooking(bookingInput());
    await confirm(r.reference);
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    await db.notification.update({ where: { dedupeKey: `reminder:${b.id}` }, data: { status: "sent", sentAt: new Date() } });
    await moveBooking(b.id, slot(6, "11:00"), actor);
    const reminder = await db.notification.findUniqueOrThrow({ where: { dedupeKey: `reminder:${b.id}` } });
    expect(reminder.status).toBe("pending");
    expect(reminder.sentAt).toBeNull();
  });

  it("can move to a time that overlaps its own old time, because it never counts against itself", async () => {
    const r = await createPendingBooking(bookingInput());
    await confirm(r.reference);
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    await expect(moveBooking(b.id, slot(3, "11:00"), actor)).resolves.toEqual({ status: "confirmed", confirmedByMove: false });
  });

  it("refuses unpaid, cancelled and past moves", async () => {
    const r = await createPendingBooking(bookingInput());
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    await expect(moveBooking(b.id, slot(4, "10:00"), actor)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await confirm(r.reference);
    await expect(moveBooking(b.id, new Date(Date.now() - 3_600_000).toISOString(), actor)).rejects.toMatchObject({ code: "VALIDATION" });
    await setBookingStatus(b.id, "cancelled", actor);
    await expect(moveBooking(b.id, slot(4, "10:00"), actor)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });
});

describe("services, extras and closures (admin)", () => {
  const service = (over: Partial<ServiceInput> = {}): ServiceInput => ({
    id: null, name: "Braids", description: "", priceKobo: 2_000_000, durationMinutes: 180, active: true,
    bookableAlone: true, availableAsAddOn: false, addOnPriceKobo: null, addOnDurationMinutes: null, addOnIds: [], ...over,
  });

  it("adds an extra to a main service, and the booking prices it with the extra's own terms", async () => {
    await upsertService(service({ id: "svc_other", name: "Scalp", priceKobo: 500_000, durationMinutes: 30, bookableAlone: false, availableAsAddOn: true, addOnPriceKobo: 250_000, addOnDurationMinutes: 15 }), actor);
    await upsertService(service({ id: "svc_main", name: "Retwist", priceKobo: 1_500_000, durationMinutes: 120, addOnIds: ["svc_wash", "svc_other"] }), actor);
    const r = await createPendingBooking(bookingInput({ addOnIds: ["svc_other"] }));
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    expect(b.totalKobo).toBe(1_750_000);
    expect(b.endAt.getTime() - b.startAt.getTime()).toBe(135 * 60_000);
  });

  it("refuses an extra that isn't set up as one, and a service that is neither main nor extra", async () => {
    await expect(upsertService(service({ addOnIds: ["svc_main"] }), actor)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(upsertService(service({ bookableAlone: false }), actor)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("removes a service from every main service's extras when it stops being an extra", async () => {
    await upsertService(service({ id: "svc_wash", name: "Wash", priceKobo: 300_000, durationMinutes: 30, bookableAlone: true, availableAsAddOn: false }), actor);
    expect(await db.serviceAddOn.count({ where: { addOnServiceId: "svc_wash" } })).toBe(0);
  });

  it("stores a service photo under a fresh key, replaces it with a new key, and removes it", async () => {
    const { GET } = await import("@/app/media/services/[id]/[key]/route");
    const get = (id: string, key: string) => GET(new Request("http://localhost/"), { params: Promise.resolve({ id, key }) });

    await upsertService(service({ id: "svc_main", name: "Retwist", photo: { action: "set", data: webpBytes(800, 600), contentType: "image/webp", width: 800, height: 600 }, photoAlt: "Fresh retwist" }), actor);
    const first = await db.service.findUniqueOrThrow({ where: { id: "svc_main" } });
    expect(first).toMatchObject({ photoAlt: "Fresh retwist", photoWidth: 800, photoHeight: 600 });
    const res = await get("svc_main", first.photoKey!);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("immutable");

    // Saving without a photo change keeps it; a new photo changes the key and retires the old address.
    await upsertService(service({ id: "svc_main", name: "Retwist", photoAlt: "Fresh retwist" }), actor);
    expect((await db.service.findUniqueOrThrow({ where: { id: "svc_main" } })).photoKey).toBe(first.photoKey);
    await upsertService(service({ id: "svc_main", name: "Retwist", photo: { action: "set", data: webpBytes(400, 400), contentType: "image/webp", width: 400, height: 400 } }), actor);
    const second = await db.service.findUniqueOrThrow({ where: { id: "svc_main" } });
    expect(second.photoKey).not.toBe(first.photoKey);
    expect((await get("svc_main", first.photoKey!)).status).toBe(404);

    await upsertService(service({ id: "svc_main", name: "Retwist", photo: { action: "remove" } }), actor);
    expect(await db.service.findUniqueOrThrow({ where: { id: "svc_main" } })).toMatchObject({ photoKey: null, photoAlt: "" });
    expect(await db.servicePhoto.count()).toBe(0);
    expect((await get("svc_main", second.photoKey!)).status).toBe(404);
  });

  it("a closure stops new bookings, reports bookings already in it, and removing it frees the time", async () => {
    await createPendingBooking(bookingInput({ startAt: slot(3, "15:00") }));
    const { affectedBookings } = await createBlock({ startAt: new Date(slot(3, "09:00")), endAt: new Date(slot(3, "19:00")), capacityReduction: null, reason: "Staff training" }, actor);
    expect(affectedBookings).toBe(1);
    await expect(createPendingBooking(bookingInput())).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    const block = await db.block.findFirstOrThrow();
    await deleteBlock(block.id, actor);
    await expect(createPendingBooking(bookingInput())).resolves.toMatchObject({ reference: expect.any(String) });
  });

  it("refuses a closure that ends before it starts", async () => {
    await expect(createBlock({ startAt: new Date(slot(3, "12:00")), endAt: new Date(slot(3, "11:00")), capacityReduction: null, reason: "" }, actor)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("manual payments and corrections", () => {
  it("adds a correction as a new ledger row; earlier rows are never changed", async () => {
    const r = await createPendingBooking(bookingInput());
    const booking = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    await recordManualPayment(booking.id, { amountKobo: 540_000, method: "cash", note: "", purpose: "deposit" }, actor);
    await recordManualPayment(booking.id, { amountKobo: 50_000, method: "cash", note: "", purpose: "balance" }, actor);
    await recordManualPayment(booking.id, { amountKobo: -50_000, method: "cash", note: "Typed twice", purpose: "correction" }, actor);
    const rows = await db.payment.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => [r.type, r.amountKobo])).toEqual([["manual", 540_000], ["manual", 50_000], ["adjustment", -50_000]]);
    expect(rows.reduce((s, r) => s + r.amountKobo, 0)).toBe(540_000);
  });

  it("needs a reason for a correction, and refuses negative ordinary payments", async () => {
    const r = await createPendingBooking(bookingInput());
    const booking = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    await expect(recordManualPayment(booking.id, { amountKobo: -100, method: "cash", note: " ", purpose: "correction" }, actor)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(recordManualPayment(booking.id, { amountKobo: -100, method: "cash", note: "", purpose: "balance" }, actor)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("won't take off more than has been recorded, so the balance can't exceed the total", async () => {
    const r = await createPendingBooking(bookingInput());
    const booking = await db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
    await recordManualPayment(booking.id, { amountKobo: 200_000, method: "cash", note: "", purpose: "deposit" }, actor);
    await expect(
      recordManualPayment(booking.id, { amountKobo: -1_000_000, method: "cash", note: "Wrong booking", purpose: "correction" }, actor),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await recordManualPayment(booking.id, { amountKobo: -200_000, method: "cash", note: "Wrong booking", purpose: "correction" }, actor);
    expect((await db.payment.aggregate({ _sum: { amountKobo: true } }))._sum.amountKobo).toBe(0);
  });
});

describe("customer tags and marketing consent", () => {
  async function customer() {
    const r = await createPendingBooking(bookingInput({ marketingConsent: true }));
    return (await db.booking.findUniqueOrThrow({ where: { reference: r.reference } })).customerId;
  }

  it("saves tidy tags, logs the change once, and refuses too many or too long", async () => {
    const id = await customer();
    await updateCustomerTags(id, [" VIP ", "vip", "Sensitive   scalp", ""], actor);
    expect((await db.customer.findUniqueOrThrow({ where: { id } })).tags).toEqual(["VIP", "Sensitive scalp"]);
    await updateCustomerTags(id, ["VIP", "Sensitive scalp"], actor);
    const logs = await db.auditLog.findMany({ where: { customerId: id, action: "customer.tags" } });
    expect(logs.map((l) => l.summary)).toEqual(["Tags set to VIP, Sensitive scalp"]);
    await expect(updateCustomerTags(id, Array.from({ length: 11 }, (_, i) => `t${i}`), actor)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateCustomerTags(id, ["x".repeat(25)], actor)).rejects.toMatchObject({ code: "VALIDATION" });
    await updateCustomerTags(id, [], actor);
    expect(await db.auditLog.findFirst({ where: { customerId: id, summary: "Tags cleared" } })).not.toBeNull();
  });

  it("turns marketing messages off and on, recording when, under the admin's name", async () => {
    const id = await customer();
    await setMarketingConsent(id, false, actor);
    expect(await db.customer.findUniqueOrThrow({ where: { id } })).toMatchObject({ marketingConsent: false, marketingConsentAt: null });
    await setMarketingConsent(id, false, actor);
    await setMarketingConsent(id, true, actor);
    const c = await db.customer.findUniqueOrThrow({ where: { id } });
    expect(c.marketingConsent).toBe(true);
    expect(c.marketingConsentAt).not.toBeNull();
    const logs = await db.auditLog.findMany({ where: { customerId: id, action: "customer.marketing_consent" }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => [l.summary, l.actorLabel])).toEqual([
      ["Marketing messages turned off", "Test admin"],
      ["Marketing messages turned on", "Test admin"],
    ]);
  });
});
