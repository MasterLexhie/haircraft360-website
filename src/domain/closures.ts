import { formatDateKey, formatTime, lagosDateKey, lagosMinutes } from "@/lib/time";

type At = Date | number | string;

/**
 * A closure period in plain words, used on the Closures tab and in the activity log:
 * "Sat, 28 Nov, all day", "Sat, 28 Nov, 12:00 pm to 3:00 pm", or a range across days.
 */
export function describeClosurePeriod(startAt: At, endAt: At): string {
  const startDay = lagosDateKey(startAt);
  const endMs = new Date(endAt).getTime();
  // A whole-day closure ends at midnight, which belongs to the day before.
  const endsAtMidnight = lagosMinutes(endMs) === 0;
  const lastDay = lagosDateKey(endsAtMidnight ? endMs - 1 : endMs);
  const wholeDays = lagosMinutes(startAt) === 0 && endsAtMidnight;
  if (wholeDays) return startDay === lastDay ? `${formatDateKey(startDay)}, all day` : `${formatDateKey(startDay)} to ${formatDateKey(lastDay)}, all day`;
  if (startDay === lastDay) return `${formatDateKey(startDay)}, ${formatTime(startAt)} to ${formatTime(endAt)}`;
  return `${formatDateKey(startDay)} ${formatTime(startAt)} to ${formatDateKey(lastDay)} ${formatTime(endAt)}`;
}
