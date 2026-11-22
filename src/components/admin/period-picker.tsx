import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarRange } from "lucide-react";
import { PERIOD_LABELS, PERIOD_PRESETS, type Period, type PeriodPreset } from "@/domain/periods";
import { Alert, buttonClass, cx, inputClass } from "@/components/ui/primitives";

const SHORT: Partial<Record<PeriodPreset, string>> = { custom: "Custom" };

/**
 * Period choice for Finances and Expenses. The presets are plain links, so one tap shows the
 * period. Custom opens with the current range already filled in; only then do the date boxes
 * and an Apply button appear. `keep` carries other filters (the expense category) through the
 * links, and `children` adds more fields to the same form.
 */
export function PeriodPicker({ action, period, keep = {}, children }: { action: string; period: Period; keep?: Record<string, string | undefined>; children?: ReactNode }) {
  const custom = period.preset === "custom" || !!period.error;
  // Nothing to type in: on wide screens the chips and the date range share one row.
  const oneRow = !custom && !children;
  const href = (preset: PeriodPreset) => {
    const q = new URLSearchParams(Object.entries(keep).filter((e): e is [string, string] => !!e[1]));
    if (preset !== "month") q.set("period", preset);
    if (preset === "custom") {
      q.set("from", period.fromKey);
      q.set("to", period.toKey);
    }
    const s = q.toString();
    return s ? `${action}?${s}` : action;
  };

  return (
    <div className="mb-6 space-y-3">
      <section aria-label="Period" className={cx("overflow-hidden rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)]", oneRow && "lg:flex lg:items-center")}>
        <nav aria-label="Period" className={cx("relative min-w-0 border-b border-line", oneRow && "lg:flex-1 lg:border-b-0")}>
          <ul className="flex gap-2 overflow-x-auto px-3 py-3 pr-8 md:pr-3">
            {PERIOD_PRESETS.map((p) => {
              const active = p === (custom ? "custom" : period.preset);
              return (
                <li key={p} className="shrink-0">
                  <Link
                    href={href(p)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors",
                      active ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface text-ink hover:bg-sand",
                    )}
                  >
                    {p === "custom" && <CalendarRange aria-hidden className="size-3.5" />}
                    {SHORT[p] ?? PERIOD_LABELS[p]}
                  </Link>
                </li>
              );
            })}
          </ul>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-surface md:hidden" />
        </nav>

        <form action={action} className={cx("flex flex-wrap items-end gap-3 px-4 py-3", oneRow && "lg:shrink-0 lg:py-0")}>
          {/* Other filters ride along as hidden fields, unless they are fields of their own here. */}
          {!children && Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          {custom ? (
            <>
              <input type="hidden" name="period" value="custom" />
              <label className="block min-w-[140px] flex-1 sm:flex-none">
                <span className="mb-1 block text-xs font-semibold text-ink-2">From</span>
                <input type="date" name="from" required defaultValue={period.preset === "custom" ? period.fromKey : ""} className={cx(inputClass, "text-sm")} />
              </label>
              <label className="block min-w-[140px] flex-1 sm:flex-none">
                <span className="mb-1 block text-xs font-semibold text-ink-2">To</span>
                <input type="date" name="to" required defaultValue={period.preset === "custom" ? period.toKey : ""} className={cx(inputClass, "text-sm")} />
              </label>
            </>
          ) : (
            <>
              {period.preset !== "month" && <input type="hidden" name="period" value={period.preset} />}
              {/* With other fields here, the page heading under the card already names the dates. */}
              {!children && <p className={cx("flex min-h-11 flex-1 items-center gap-2 text-sm text-ink-2", oneRow && "lg:min-h-0")}>
                <CalendarRange aria-hidden className="size-4 shrink-0 text-ink-3" />
                <span className="font-semibold text-ink">{period.label}</span>
              </p>}
            </>
          )}
          {children}
          {(custom || children) && <button className={buttonClass("primary", "md", custom ? "max-sm:w-full" : undefined)}>Apply</button>}
        </form>
      </section>

      {period.error && (
        <Alert tone="warning" title={period.error}>
          Showing this month until both dates are chosen.
        </Alert>
      )}
    </div>
  );
}
