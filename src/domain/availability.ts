import type { AvailabilitySettings, Booking } from "./types";
import type { WeekdayKey } from "./settings";
import { addDays, dayOfWeek, lagosDateKey, lagosToUtcMs, parseHHMM } from "@/lib/time";

/**
 * Slot calculation (BUILD_SPEC 6.2). Pure: the server passes in bookings and settings.
 *
 * Each booking occupies one unit of capacity from its start until its end plus the
 * buffer. A time is available only if, across the new booking's duration plus buffer,
 * fewer bookings overlap than the day's capacity.
 *
 * Blocks (admin closures) arrive in Milestone 3.
 */

export interface Interval {
  start: number;
  end: number;
}

export interface Slot {
  startAt: string;
  endAt: string;
  /** Minutes after Lagos midnight, for grouping. */
  minutes: number;
  available: boolean;
}

export type DateStatus = "open" | "closed" | "past" | "beyond_horizon";

export interface DateOption {
  dateKey: string;
  status: DateStatus;
  availableCount: number;
}

type OccupyingBooking = Pick<Booking, "id" | "status" | "startAt" | "endAt" | "holdExpiresAt">;

/**
 * Confirmed and completed bookings occupy their time, and so do unpaid bookings
 * whose hold is still running. Expired holds are simply ignored, so no cleanup job
 * is needed. `needs_attention` bookings were paid after their time was taken, so
 * they do not hold capacity until the owner moves them.
 */
export function isOccupying(booking: Pick<Booking, "status" | "holdExpiresAt">, nowMs: number): boolean {
  if (booking.status === "confirmed" || booking.status === "completed") return true;
  if (booking.status === "pending_payment") {
    return booking.holdExpiresAt !== null && Date.parse(booking.holdExpiresAt) > nowMs;
  }
  return false;
}

export function occupiedIntervals(bookings: OccupyingBooking[], nowMs: number, bufferMinutes: number, excludeBookingId?: string): Interval[] {
  return bookings
    .filter((b) => b.id !== excludeBookingId && isOccupying(b, nowMs))
    .map((b) => ({ start: Date.parse(b.startAt), end: Date.parse(b.endAt) + bufferMinutes * 60_000 }));
}

function overlapCount(intervals: Interval[], start: number, end: number): number {
  return intervals.filter((i) => i.start < end && start < i.end).length;
}

export function capacityFor(dateKey: string, config: AvailabilitySettings): number {
  return config.capacityByWeekday[String(dayOfWeek(dateKey)) as WeekdayKey] ?? 0;
}

function hoursFor(dateKey: string, config: AvailabilitySettings) {
  return config.weeklyHours[String(dayOfWeek(dateKey)) as WeekdayKey];
}

function dateStatus(dateKey: string, config: AvailabilitySettings, nowMs: number): DateStatus {
  const today = lagosDateKey(nowMs);
  if (dateKey < today) return "past";
  if (dateKey > addDays(today, config.bookingHorizonDays)) return "beyond_horizon";
  if (!hoursFor(dateKey, config) || capacityFor(dateKey, config) < 1) return "closed";
  return "open";
}

/** All candidate slots for a date, each marked available or not. */
export function slotsForDate(params: {
  dateKey: string;
  durationMinutes: number;
  config: AvailabilitySettings;
  bookings: OccupyingBooking[];
  nowMs: number;
  excludeBookingId?: string;
}): { status: DateStatus; slots: Slot[] } {
  const { dateKey, durationMinutes, config, bookings, nowMs } = params;
  const status = dateStatus(dateKey, config, nowMs);
  if (status !== "open") return { status, slots: [] };

  const hours = hoursFor(dateKey, config)!;
  const open = parseHHMM(hours.open);
  const close = parseHHMM(hours.close);
  const capacity = capacityFor(dateKey, config);
  const buffer = config.bufferMinutes * 60_000;
  const earliest = nowMs + config.minimumLeadMinutes * 60_000;
  const intervals = occupiedIntervals(bookings, nowMs, config.bufferMinutes, params.excludeBookingId);
  const slots: Slot[] = [];

  for (let m = open; m + durationMinutes <= close; m += config.slotIntervalMinutes) {
    const start = lagosToUtcMs(dateKey, m);
    const end = start + durationMinutes * 60_000;
    const available = start >= earliest && overlapCount(intervals, start, end + buffer) < capacity;
    slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), minutes: m, available });
  }
  return { status, slots };
}

/** Date strip for the booking calendar: today through the horizon. */
export function dateOptions(params: {
  durationMinutes: number;
  config: AvailabilitySettings;
  bookings: OccupyingBooking[];
  nowMs: number;
}): DateOption[] {
  const today = lagosDateKey(params.nowMs);
  const out: DateOption[] = [];
  for (let i = 0; i <= params.config.bookingHorizonDays; i++) {
    const dateKey = addDays(today, i);
    const { status, slots } = slotsForDate({ ...params, dateKey });
    out.push({ dateKey, status, availableCount: slots.filter((s) => s.available).length });
  }
  return out;
}

/**
 * Authoritative check used when reserving. The start must land on the slot grid
 * inside opening hours, within the horizon, with capacity free.
 */
export function isSlotBookable(params: {
  startAt: string;
  durationMinutes: number;
  config: AvailabilitySettings;
  bookings: OccupyingBooking[];
  nowMs: number;
  excludeBookingId?: string;
}): boolean {
  const dateKey = lagosDateKey(params.startAt);
  const { slots } = slotsForDate({ ...params, dateKey });
  const startMs = Date.parse(params.startAt);
  return slots.some((s) => Date.parse(s.startAt) === startMs && s.available);
}
