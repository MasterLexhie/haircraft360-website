"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarX2, ChevronLeft, ChevronRight, Phone, RefreshCw } from "lucide-react";
import type { DateOption, Slot } from "@/domain/availability";
import { business } from "@/config/business";
import { dayOfWeek, formatDateKey, formatDuration, formatTime } from "@/lib/time";
import { Alert, Button, EmptyState, Skeleton, cx } from "@/components/ui/primitives";

interface AvailabilityResponse {
  dates: DateOption[];
  date: string | null;
  status: string | null;
  slots: Slot[];
}

export function DateTimeStep({
  durationMinutes,
  dateKey,
  startAt,
  onDate,
  onSlot,
  refreshKey,
}: {
  durationMinutes: number;
  dateKey: string | null;
  startAt: string | null;
  onDate: (d: string) => void;
  onSlot: (s: string | null) => void;
  /** Bump to force a refetch (e.g. after a slot was taken). */
  refreshKey: number;
}) {
  const [retry, setRetry] = useState(0);
  // Results are stored with the request key they answer, so "loading" is derived
  // (key mismatch) instead of being reset inside effects.
  const datesKey = `${durationMinutes}|${refreshKey}|${retry}`;
  const slotsKey = dateKey ? `${dateKey}|${datesKey}` : null;
  const [datesRes, setDatesRes] = useState<{ key: string; dates: DateOption[] } | null>(null);
  const [slotsRes, setSlotsRes] = useState<{ key: string; slots: Slot[] } | null>(null);
  const [errorRes, setErrorRes] = useState<{ key: string; message: string } | null>(null);
  const [weekPick, setWeekPick] = useState<{ forDate: string | null; week: number } | null>(null);

  const dates = datesRes?.key === datesKey ? datesRes.dates : null;
  const slots = slotsRes && slotsRes.key === slotsKey ? slotsRes.slots : null;
  const error = errorRes && (errorRes.key === datesKey || errorRes.key === slotsKey) ? errorRes.message : null;

  // Date strip (with free-slot counts).
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/availability?duration=${durationMinutes}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: AvailabilityResponse) => {
        setDatesRes({ key: datesKey, dates: data.dates });
        if (!dateKey) {
          const first = data.dates.find((d) => d.status === "open" && d.availableCount > 0);
          if (first) onDate(first.dateKey);
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setErrorRes({ key: datesKey, message: "We couldn't load availability. Check your connection and try again." });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey]);

  // Slots for the chosen date.
  useEffect(() => {
    if (!dateKey || !slotsKey) return;
    const ctrl = new AbortController();
    fetch(`/api/availability?duration=${durationMinutes}&date=${dateKey}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: AvailabilityResponse) => {
        setSlotsRes({ key: slotsKey, slots: data.slots });
        if (startAt && !data.slots.some((s) => s.startAt === startAt)) onSlot(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setErrorRes({ key: slotsKey, message: "We couldn't load times for that day. Please try again." });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsKey]);

  // Calendar weeks aligned Monday → Sunday.
  const weeks = useMemo(() => {
    if (!dates?.length) return [];
    const lead = (dayOfWeek(dates[0].dateKey) + 6) % 7;
    const cells: (DateOption | null)[] = [...Array(lead).fill(null), ...dates];
    while (cells.length % 7) cells.push(null);
    const out: (DateOption | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [dates]);

  // Show the selected date's fortnight unless the user paged away from it.
  const selectedIdx = dateKey ? weeks.findIndex((w) => w.some((c) => c?.dateKey === dateKey)) : -1;
  const autoWeek = selectedIdx >= 0 ? Math.floor(selectedIdx / 2) * 2 : 0;
  const week = weekPick && weekPick.forDate === dateKey ? weekPick.week : autoWeek;
  const setWeek = (fn: (w: number) => number) => setWeekPick({ forDate: dateKey, week: fn(week) });

  const nextAvailable = dates?.find((d) => d.dateKey > (dateKey ?? "") && d.status === "open" && d.availableCount > 0);

  if (error) {
    return (
      <Alert tone="danger" title="Availability didn't load" role="alert">
        <p>{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setRetry((n) => n + 1)}>
          <RefreshCw aria-hidden className="size-4" /> Try again
        </Button>
      </Alert>
    );
  }

  const visibleWeeks = weeks.slice(week, week + 2);
  const groups = slots
    ? [
        { label: "Morning", items: slots.filter((s) => s.minutes < 12 * 60) },
        { label: "Afternoon", items: slots.filter((s) => s.minutes >= 12 * 60 && s.minutes < 17 * 60) },
        { label: "Evening", items: slots.filter((s) => s.minutes >= 17 * 60) },
      ].filter((g) => g.items.length)
    : [];

  return (
    <div className="space-y-8">
      <fieldset>
        <div className="mb-3 flex items-center justify-between">
          <legend className="text-sm font-semibold text-ink">Choose a date</legend>
          <div className="flex gap-1">
            <button type="button" className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong bg-surface hover:bg-sand disabled:opacity-40" onClick={() => setWeek((w) => Math.max(0, w - 2))} disabled={week === 0}>
              <ChevronLeft aria-hidden className="size-5" />
              <span className="sr-only">Earlier dates</span>
            </button>
            <button type="button" className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong bg-surface hover:bg-sand disabled:opacity-40" onClick={() => setWeek((w) => Math.min(weeks.length - 1, w + 2))} disabled={week + 2 >= weeks.length}>
              <ChevronRight aria-hidden className="size-5" />
              <span className="sr-only">Later dates</span>
            </button>
          </div>
        </div>

        {!dates ? (
          <Skeleton className="h-40" />
        ) : (
          <div role="grid" aria-label="Available dates" className="space-y-1.5">
            <div role="row" className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-ink-3">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <span role="columnheader" key={d}>{d}</span>
              ))}
            </div>
            {visibleWeeks.map((row, ri) => (
              <div role="row" key={ri} className="grid grid-cols-7 gap-1.5">
                {row.map((cell, ci) => {
                  if (!cell) return <span role="gridcell" key={ci} />;
                  const bookable = cell.status === "open" && cell.availableCount > 0;
                  const selected = cell.dateKey === dateKey;
                  const note = cell.status === "closed" ? "Closed" : cell.status !== "open" ? "—" : cell.availableCount === 0 ? "Full" : `${cell.availableCount} free`;
                  return (
                    <span role="gridcell" key={cell.dateKey}>
                      <button
                        type="button"
                        disabled={!bookable}
                        aria-pressed={selected}
                        aria-label={`${formatDateKey(cell.dateKey, { long: true })}: ${bookable ? `${cell.availableCount} times available` : note === "Closed" ? "closed" : "fully booked"}`}
                        onClick={() => onDate(cell.dateKey)}
                        className={cx(
                          "flex min-h-14 w-full flex-col items-center justify-center rounded-[var(--radius)] border text-sm transition-colors",
                          selected
                            ? "border-accent bg-accent text-on-accent"
                            : bookable
                              ? "border-line-strong bg-surface text-ink hover:border-accent"
                              : "border-transparent bg-sand/60 text-ink-3 line-through decoration-ink-3/40",
                        )}
                      >
                        <span className="tabular text-base font-semibold no-underline">{Number(cell.dateKey.slice(8))}</span>
                        <span className={cx("text-[0.68rem] leading-tight", selected ? "text-on-night-2" : bookable ? "text-ink-3" : "")}>{note}</span>
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-ink">
          {dateKey ? `Available times on ${formatDateKey(dateKey)}` : "Choose a time"}
        </legend>
        {!dateKey ? (
          <p className="text-sm text-ink-3">Pick a date to see times.</p>
        ) : !slots ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="status" aria-label="Loading times">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : slots.length === 0 ? (
          <EmptyState icon={<CalendarX2 className="size-8" aria-hidden />} title={`No times left on ${formatDateKey(dateKey)}`}
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                {nextAvailable && (
                  <Button variant="primary" size="sm" onClick={() => onDate(nextAvailable.dateKey)}>
                    Try {formatDateKey(nextAvailable.dateKey)}
                  </Button>
                )}
                <a href={`tel:${business.phone.value.e164}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold hover:bg-sand">
                  <Phone aria-hidden className="size-4" /> Call the salon
                </a>
              </div>
            }
          >
            Your services need about {formatDuration(durationMinutes)} in a row. Try another date, or call to ask about other options.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">{g.label}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {g.items.map((s) => {
                    const checked = s.startAt === startAt;
                    return (
                      <label
                        key={s.startAt}
                        className={cx(
                          "relative flex min-h-11 items-center justify-center rounded-[var(--radius)] border text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                          checked ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface text-ink hover:border-accent",
                        )}
                      >
                        <input type="radio" name="slot" value={s.startAt} checked={checked} onChange={() => onSlot(s.startAt)} className="sr-only" />
                        <span className="tabular">{formatTime(s.startAt)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-xs text-ink-3">Times shown in Ibadan time (WAT). Based on demo availability settings.</p>
          </div>
        )}
      </fieldset>
    </div>
  );
}
