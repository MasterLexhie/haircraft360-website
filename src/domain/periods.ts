import { addDays, dayOfWeek, formatDateKey, isValidDateKey } from "@/lib/time";

/**
 * Report periods for Finances and Expenses (BUILD_SPEC 6.6): today, this week (Monday to
 * Sunday), this month, last month, or custom dates. All in Lagos calendar days, inclusive.
 */
export const PERIOD_PRESETS = ["today", "week", "month", "last_month", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  last_month: "Last month",
  custom: "Custom dates",
};

export const MAX_PERIOD_DAYS = 366;

export interface Period {
  preset: PeriodPreset;
  fromKey: string;
  toKey: string;
  label: string;
  /** Set when custom dates were unusable and the period fell back to this month. */
  error?: string;
}

const firstOfMonth = (dateKey: string) => `${dateKey.slice(0, 8)}01`;
const lastOfMonth = (dateKey: string) => {
  const [y, m] = dateKey.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return addDays(next, -1);
};

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000) + 1;
}

function labelFor(fromKey: string, toKey: string): string {
  return fromKey === toKey ? formatDateKey(fromKey) : `${formatDateKey(fromKey)} to ${formatDateKey(toKey)}`;
}

/** Works out a period from the page's search params. Bad input falls back to this month. */
export function resolvePeriod(todayKey: string, params: { period?: string; from?: string; to?: string }): Period {
  const preset = (PERIOD_PRESETS as readonly string[]).includes(params.period ?? "") ? (params.period as PeriodPreset) : "month";
  const make = (p: PeriodPreset, fromKey: string, toKey: string, error?: string): Period => ({ preset: p, fromKey, toKey, label: labelFor(fromKey, toKey), error });
  const thisMonth = (error?: string) => make("month", firstOfMonth(todayKey), lastOfMonth(todayKey), error);

  switch (preset) {
    case "today":
      return make("today", todayKey, todayKey);
    case "week": {
      const monday = addDays(todayKey, -((dayOfWeek(todayKey) + 6) % 7));
      return make("week", monday, addDays(monday, 6));
    }
    case "last_month": {
      const lastDay = addDays(firstOfMonth(todayKey), -1);
      return make("last_month", firstOfMonth(lastDay), lastDay);
    }
    case "custom": {
      const { from, to } = params;
      if (!from || !to || !isValidDateKey(from) || !isValidDateKey(to)) return thisMonth("Choose both dates to see a custom period.");
      if (from > to) return thisMonth("The start date is after the end date.");
      if (daysBetween(from, to) > MAX_PERIOD_DAYS) return thisMonth(`Choose a period of at most ${MAX_PERIOD_DAYS} days.`);
      return make("custom", from, to);
    }
    default:
      return thisMonth();
  }
}
