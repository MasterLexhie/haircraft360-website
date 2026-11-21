import { describe, expect, it } from "vitest";
import type { Booking, BookingStatus, Payment } from "@/domain/types";
import { customerStats, normalizeTags, ordinal, visitInfo, visitLabel } from "@/domain/crm";

let seq = 0;
function booking(startAt: string, status: BookingStatus, main = "Loc retwist", totalKobo = 1_000_000): Booking {
  seq++;
  return {
    id: `b${seq}`,
    reference: `HC-${seq}`,
    customerId: "c1",
    contactName: "Ada",
    contactPhone: "+2348030000000",
    contactEmail: null,
    contactOnWhatsapp: true,
    startAt,
    endAt: startAt,
    status,
    holdExpiresAt: null,
    totalKobo,
    depositDueKobo: 300_000,
    customerNote: "",
    privateNote: "",
    completedAt: null,
    cancelledAt: null,
    createdAt: startAt,
    updatedAt: startAt,
    items: [
      { id: `i${seq}`, serviceId: null, kind: "main", name: main, priceKobo: totalKobo, durationMinutes: 60, note: "", createdAt: startAt },
      { id: `a${seq}`, serviceId: null, kind: "add_on", name: "Wash", priceKobo: 0, durationMinutes: 15, note: "", createdAt: startAt },
    ],
  };
}
const pay = (b: Booking, amountKobo: number, status: Payment["status"] = "success") => ({ bookingId: b.id, amountKobo, status });

describe("new or returning", () => {
  const first = booking("2026-01-10T09:00:00.000Z", "completed");
  const cancelled = booking("2026-02-10T09:00:00.000Z", "cancelled");
  const noShow = booking("2026-03-10T09:00:00.000Z", "no_show");
  const second = booking("2026-04-10T09:00:00.000Z", "completed");
  const upcoming = booking("2026-12-10T09:00:00.000Z", "confirmed");
  const all = [upcoming, second, first, noShow, cancelled];

  it("counts only completed visits that came before", () => {
    expect(visitInfo(first, all)).toEqual({ returning: false, visitNumber: 1 });
    expect(visitInfo(cancelled, all)).toEqual({ returning: true, visitNumber: 2 });
    expect(visitInfo(second, all)).toEqual({ returning: true, visitNumber: 2 });
    expect(visitInfo(upcoming, all)).toEqual({ returning: true, visitNumber: 3 });
  });

  it("a cancellation or no-show doesn't make someone a returning customer", () => {
    const onlyMissed = [cancelled, noShow, upcoming];
    expect(visitLabel(visitInfo(upcoming, onlyMissed))).toBe("New");
  });

  it("labels the visit in words", () => {
    expect(visitLabel(visitInfo(upcoming, all))).toBe("Returning, 3rd visit");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"]);
  });
});

describe("customer stats", () => {
  it("adds up visits, spend, no-shows and what's owed", () => {
    const a = booking("2026-01-10T09:00:00.000Z", "completed", "Loc retwist", 1_000_000);
    const b = booking("2026-02-10T09:00:00.000Z", "completed", "Loc repair", 2_000_000);
    const c = booking("2026-03-10T09:00:00.000Z", "completed", "Loc retwist", 1_000_000);
    const missed = booking("2026-04-10T09:00:00.000Z", "no_show");
    const next = booking("2026-12-10T09:00:00.000Z", "confirmed");
    const payments = [pay(a, 1_000_000), pay(b, 1_500_000), pay(c, 1_000_000), pay(missed, 300_000), pay(next, 300_000), pay(c, 999_999, "failed")];
    const s = customerStats([a, b, c, missed, next], payments, Date.parse("2026-06-01T00:00:00Z"));
    expect(s).toEqual({
      visits: 3,
      totalSpendKobo: 4_100_000,
      averageSpendKobo: 1_166_667,
      lastVisitAt: c.startAt,
      nextVisitAt: next.startAt,
      usualServices: [
        { name: "Loc retwist", count: 2 },
        { name: "Loc repair", count: 1 },
      ],
      noShows: 1,
      outstandingKobo: 500_000,
    });
  });

  it("has no average before a first visit", () => {
    const s = customerStats([booking("2026-12-10T09:00:00.000Z", "confirmed")], [], Date.parse("2026-06-01T00:00:00Z"));
    expect(s).toMatchObject({ visits: 0, averageSpendKobo: null, lastVisitAt: null, usualServices: [] });
  });
});

describe("tags", () => {
  it("trims, collapses spaces and drops repeats regardless of capitals", () => {
    expect(normalizeTags(["  VIP", "vip ", "Sensitive   scalp", ""])).toEqual({ tags: ["VIP", "Sensitive scalp"] });
  });
  it("refuses more than ten, or one longer than 24 characters", () => {
    expect(normalizeTags(Array.from({ length: 11 }, (_, i) => `t${i}`))).toHaveProperty("error");
    expect(normalizeTags(["x".repeat(25)])).toHaveProperty("error");
    expect(normalizeTags(["x".repeat(24)])).toEqual({ tags: ["x".repeat(24)] });
  });
});
