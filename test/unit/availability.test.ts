import { describe, expect, it } from "vitest";
import { isOccupying, isSlotBookable, slotsForDate, dateOptions, type BlockWindow } from "@/domain/availability";
import type { AvailabilitySettings, BookingStatus } from "@/domain/types";
import { lagosToUtcMs } from "@/lib/time";

const DAY = "2026-12-01"; // a Tuesday
const NOW = Date.parse("2026-11-25T08:00:00Z");

const hours = { open: "08:00", close: "19:00" };
function config(capacity: number, bufferMinutes = 30): AvailabilitySettings {
  return {
    timezone: "Africa/Lagos",
    weeklyHours: { "0": null, "1": hours, "2": hours, "3": hours, "4": hours, "5": hours, "6": hours },
    capacityByWeekday: { "0": 0, "1": capacity, "2": capacity, "3": capacity, "4": capacity, "5": capacity, "6": capacity },
    slotIntervalMinutes: 30,
    bufferMinutes,
    holdMinutes: 15,
    minimumLeadMinutes: 0,
    bookingHorizonDays: 30,
  };
}

const at = (hhmm: string, day = DAY) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(lagosToUtcMs(day, h * 60 + m)).toISOString();
};

let seq = 0;
function booking(start: string, end: string, status: BookingStatus = "confirmed", holdExpiresAt: string | null = null) {
  return { id: `b${++seq}`, status, startAt: at(start), endAt: at(end), holdExpiresAt };
}

function freeTimes(params: { capacity: number; duration: number; bookings?: ReturnType<typeof booking>[]; blocks?: BlockWindow[]; buffer?: number }) {
  const { slots } = slotsForDate({
    dateKey: DAY,
    durationMinutes: params.duration,
    config: config(params.capacity, params.buffer ?? 30),
    bookings: params.bookings ?? [],
    blocks: params.blocks,
    nowMs: NOW,
  });
  return slots.filter((s) => s.available).map((s) => `${String(Math.floor(s.minutes / 60)).padStart(2, "0")}:${String(s.minutes % 60).padStart(2, "0")}`);
}

describe("availability (BUILD_SPEC 6.2)", () => {
  it("spec example: capacity 2, an 8:00 four-hour and an 8:00 one-hour booking, 30 minute buffer: the next start is 9:30", () => {
    const bookings = [booking("08:00", "12:00"), booking("08:00", "09:00")];
    const free = freeTimes({ capacity: 2, duration: 60, bookings });
    expect(free[0]).toBe("09:30");
    expect(free).not.toContain("09:00");
  });

  it("counts bookings at the same moment, not every booking that touches a long appointment", () => {
    // Capacity 2. A 9:00 to 10:00 booking and a 12:00 to 13:00 booking never run together,
    // so a 5-hour appointment from 9:00 only ever shares the salon with one of them.
    const bookings = [booking("09:00", "10:00"), booking("12:00", "13:00")];
    expect(freeTimes({ capacity: 2, duration: 300, bookings, buffer: 0 })).toContain("09:00");
  });

  it("refuses a time when bookings overlap each other inside the new appointment", () => {
    const bookings = [booking("09:00", "12:00"), booking("11:00", "13:00")];
    expect(freeTimes({ capacity: 2, duration: 300, bookings, buffer: 0 })).not.toContain("09:00");
  });

  it("includes the new booking's own buffer before the next booking", () => {
    // Capacity 1, booking at 12:00. A 2-hour appointment at 10:00 ends at 12:00 but needs 30 minutes to clean up.
    const free = freeTimes({ capacity: 1, duration: 120, bookings: [booking("12:00", "13:00")] });
    expect(free).not.toContain("10:00");
    expect(free).toContain("09:30");
  });

  it("only counts live holds: expired holds, cancelled and needs-attention bookings free the time", () => {
    const live = new Date(NOW + 10 * 60_000).toISOString();
    const gone = new Date(NOW - 60_000).toISOString();
    expect(isOccupying({ status: "pending_payment", holdExpiresAt: live }, NOW)).toBe(true);
    expect(isOccupying({ status: "pending_payment", holdExpiresAt: gone }, NOW)).toBe(false);
    for (const status of ["cancelled", "expired", "no_show", "needs_attention"] as const) {
      expect(isOccupying({ status, holdExpiresAt: null }, NOW)).toBe(false);
    }
    expect(freeTimes({ capacity: 1, duration: 60, bookings: [booking("10:00", "11:00", "pending_payment", gone)] })).toContain("10:00");
    expect(freeTimes({ capacity: 1, duration: 60, bookings: [booking("10:00", "11:00", "pending_payment", live)] })).not.toContain("10:00");
  });

  it("a closing Block removes every time it touches", () => {
    const blocks = [{ startAt: at("12:00"), endAt: at("15:00"), capacityReduction: null }];
    const free = freeTimes({ capacity: 3, duration: 60, blocks, buffer: 0 });
    expect(free).toContain("11:00");
    expect(free).not.toContain("11:30");
    expect(free).not.toContain("14:30");
    expect(free).toContain("15:00");
  });

  it("a reducing Block lowers capacity only for its period", () => {
    const blocks = [{ startAt: at("08:00"), endAt: at("13:00"), capacityReduction: 1 }];
    const bookings = [booking("10:00", "11:00")];
    // Capacity 2 minus 1 during the Block: the 10:00 booking fills it.
    expect(freeTimes({ capacity: 2, duration: 60, bookings, blocks, buffer: 0 })).not.toContain("10:00");
    expect(freeTimes({ capacity: 2, duration: 60, bookings, blocks: [], buffer: 0 })).toContain("10:00");
  });

  it("a whole-day Block shows the date with no free times", () => {
    const blocks = [{ startAt: at("00:00"), endAt: at("00:00", "2026-12-02"), capacityReduction: null }];
    const day = dateOptions({ durationMinutes: 60, config: config(2), bookings: [], blocks, nowMs: NOW }).find((d) => d.dateKey === DAY);
    expect(day?.availableCount).toBe(0);
  });

  it("only accepts starts on the slot grid inside opening hours", () => {
    const base = { durationMinutes: 60, config: config(1), bookings: [], nowMs: NOW };
    expect(isSlotBookable({ ...base, startAt: at("10:00") })).toBe(true);
    expect(isSlotBookable({ ...base, startAt: at("10:10") })).toBe(false);
    expect(isSlotBookable({ ...base, startAt: at("18:30") })).toBe(false); // would end after closing
    expect(isSlotBookable({ ...base, startAt: at("10:00", "2026-11-29") })).toBe(false); // Sunday, closed
  });
});
