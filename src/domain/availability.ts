import type { AvailabilityConfig, Booking } from "./types";
import { addDays, dayOfWeek, lagosDateKey, lagosToUtcMs, parseHHMM } from "@/lib/time";

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

/**
 * A booking blocks its time when it is confirmed/completed, or while its
 * unpaid deposit hold is still running. Expired holds, failed checkouts,
 * cancellations and no-shows free the slot.
 */
export function isBlocking(booking: Booking, nowMs: number): boolean {
  if (booking.status === "confirmed" || booking.status === "completed") return true;
  if (booking.status === "awaiting_deposit") {
    return booking.holdExpiresAt !== null && Date.parse(booking.holdExpiresAt) > nowMs;
  }
  return false;
}

export function blockingIntervals(bookings: Booking[], nowMs: number, excludeBookingId?: string): Interval[] {
  return bookings
    .filter((b) => b.id !== excludeBookingId && isBlocking(b, nowMs))
    .map((b) => ({ start: Date.parse(b.startAt), end: Date.parse(b.endAt) }));
}

function overlapCount(intervals: Interval[], start: number, end: number): number {
  return intervals.filter((i) => i.start < end && start < i.end).length;
}

function dateStatus(dateKey: string, config: AvailabilityConfig, nowMs: number): DateStatus {
  const today = lagosDateKey(nowMs);
  if (dateKey < today) return "past";
  if (dateKey > addDays(today, config.bookingHorizonDays)) return "beyond_horizon";
  if (!config.weeklyHours[dayOfWeek(dateKey)]) return "closed";
  return "open";
}

/** All candidate slots for a date, each marked available or not. */
export function slotsForDate(params: {
  dateKey: string;
  durationMinutes: number;
  config: AvailabilityConfig;
  bookings: Booking[];
  nowMs: number;
  excludeBookingId?: string;
}): { status: DateStatus; slots: Slot[] } {
  const { dateKey, durationMinutes, config, bookings, nowMs } = params;
  const status = dateStatus(dateKey, config, nowMs);
  if (status !== "open") return { status, slots: [] };

  const hours = config.weeklyHours[dayOfWeek(dateKey)]!;
  const open = parseHHMM(hours.open);
  const close = parseHHMM(hours.close);
  const earliest = nowMs + config.minimumLeadMinutes * 60_000;
  const intervals = blockingIntervals(bookings, nowMs, params.excludeBookingId);
  const slots: Slot[] = [];

  for (let m = open; m + durationMinutes <= close; m += config.slotStepMinutes) {
    const start = lagosToUtcMs(dateKey, m);
    const end = start + durationMinutes * 60_000;
    const available = start >= earliest && overlapCount(intervals, start, end) < config.concurrentCapacity;
    slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), minutes: m, available });
  }
  return { status, slots };
}

/** Date strip for the booking calendar: today through the horizon. */
export function dateOptions(params: {
  durationMinutes: number;
  config: AvailabilityConfig;
  bookings: Booking[];
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
 * Authoritative check used when reserving. Requires the start to land on the
 * slot grid inside opening hours, within the horizon, and to have capacity.
 */
export function isSlotBookable(params: {
  startAt: string;
  durationMinutes: number;
  config: AvailabilityConfig;
  bookings: Booking[];
  nowMs: number;
}): boolean {
  const dateKey = lagosDateKey(params.startAt);
  const { slots } = slotsForDate({ ...params, dateKey });
  const startMs = Date.parse(params.startAt);
  return slots.some((s) => Date.parse(s.startAt) === startMs && s.available);
}
