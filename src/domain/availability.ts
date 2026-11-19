import type { AvailabilitySettings, Booking } from "./types";
import type { WeekdayKey } from "./settings";
import { addDays, dayOfWeek, lagosDateKey, lagosToUtcMs, parseHHMM } from "@/lib/time";

/**
 * Slot calculation (BUILD_SPEC 6.2). Pure: the server passes in bookings and settings.
 *
 * Each booking occupies one unit of capacity from its start until its end plus the
 * buffer. A time is available only if, at every moment of the new booking's duration
 * plus buffer, the bookings running at that moment are below the capacity left after
 * any Blocks (admin closures or reductions) covering that moment.
 */

export interface Interval {
  start: number;
  end: number;
}

/** An admin Block. `capacityReduction` null closes the salon for the period. */
export interface BlockWindow {
  startAt: string;
  endAt: string;
  capacityReduction: number | null;
}

export interface Load extends Interval {
  /** Capacity used: 1 for a booking, the reduction for a Block (Infinity when closed). */
  units: number;
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

function blockLoads(blocks: BlockWindow[]): Load[] {
  return blocks.map((b) => ({ start: Date.parse(b.startAt), end: Date.parse(b.endAt), units: b.capacityReduction ?? Infinity }));
}

/**
 * The most capacity in use at any single moment of [start, end). Load only rises where
 * an interval begins, so checking the window start and every start inside it is enough.
 * Two bookings that touch the window at different times are not counted together.
 */
export function peakLoad(loads: Load[], start: number, end: number): number {
  const inWindow = loads.filter((l) => l.start < end && start < l.end);
  const points = [start, ...inWindow.map((l) => l.start).filter((t) => t > start)];
  let peak = 0;
  for (const t of points) {
    let used = 0;
    for (const l of inWindow) if (l.start <= t && t < l.end) used += l.units;
    if (used > peak) peak = used;
  }
  return peak;
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
  blocks?: BlockWindow[];
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
  const loads: Load[] = [
    ...occupiedIntervals(bookings, nowMs, config.bufferMinutes, params.excludeBookingId).map((i) => ({ ...i, units: 1 })),
    ...blockLoads(params.blocks ?? []),
  ];
  const slots: Slot[] = [];

  for (let m = open; m + durationMinutes <= close; m += config.slotIntervalMinutes) {
    const start = lagosToUtcMs(dateKey, m);
    const end = start + durationMinutes * 60_000;
    const available = start >= earliest && peakLoad(loads, start, end + buffer) < capacity;
    slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), minutes: m, available });
  }
  return { status, slots };
}

/** Date strip for the booking calendar: today through the horizon. */
export function dateOptions(params: {
  durationMinutes: number;
  config: AvailabilitySettings;
  bookings: OccupyingBooking[];
  blocks?: BlockWindow[];
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
  blocks?: BlockWindow[];
  nowMs: number;
  excludeBookingId?: string;
}): boolean {
  const dateKey = lagosDateKey(params.startAt);
  const { slots } = slotsForDate({ ...params, dateKey });
  const startMs = Date.parse(params.startAt);
  return slots.some((s) => Date.parse(s.startAt) === startMs && s.available);
}
