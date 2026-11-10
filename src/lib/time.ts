/**
 * Time helpers pinned to the salon timezone.
 * Africa/Lagos is UTC+1 all year (no daylight saving), which keeps the mock
 * slot maths simple. A production build should use a tz-aware library.
 */

export const SALON_TZ = "Africa/Lagos";
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** "YYYY-MM-DD" for the given instant, in Lagos time. */
export function lagosDateKey(at: Date | number | string): string {
  const ms = new Date(at).getTime();
  return new Date(ms + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** Minutes after Lagos midnight for the given instant. */
export function lagosMinutes(at: Date | number | string): number {
  const ms = new Date(at).getTime() + LAGOS_OFFSET_MS;
  return Math.floor((ms % DAY) / MINUTE);
}

/** 0 = Sunday … 6 = Saturday, for a "YYYY-MM-DD" key. */
export function dayOfWeek(dateKey: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** Lagos date + minutes after midnight -> UTC epoch ms. */
export function lagosToUtcMs(dateKey: string, minutes: number): number {
  return Date.parse(`${dateKey}T00:00:00Z`) + minutes * MINUTE - LAGOS_OFFSET_MS;
}

export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: SALON_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const longDateFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: SALON_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: SALON_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const shortDateFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: SALON_TZ,
  day: "numeric",
  month: "short",
});

export function formatDate(at: string | number | Date): string {
  return dateFmt.format(new Date(at));
}
export function formatLongDate(at: string | number | Date): string {
  return longDateFmt.format(new Date(at));
}
export function formatShortDate(at: string | number | Date): string {
  return shortDateFmt.format(new Date(at));
}
export function formatTime(at: string | number | Date): string {
  return timeFmt.format(new Date(at)).replace(/\s?([ap])\.?m\.?/i, (_, p) => ` ${p.toLowerCase()}m`);
}
export function formatDateTime(at: string | number | Date): string {
  return `${formatDate(at)}, ${formatTime(at)}`;
}

/** Date key -> label without timezone drift ("Tue, 11 Nov"). */
export function formatDateKey(dateKey: string, opts: { long?: boolean } = {}): string {
  const noonUtc = lagosToUtcMs(dateKey, 12 * 60);
  return opts.long ? formatLongDate(noonUtc) : formatDate(noonUtc);
}

/** "08:00" -> "8:00 am" */
export function formatHHMM(value: string): string {
  const mins = parseHHMM(value);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = `${h} hr${h === 1 ? "" : "s"}`;
  return m ? `${hours} ${m} min` : hours;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
