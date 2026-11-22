import type { ReactNode } from "react";
import { PERIOD_LABELS, PERIOD_PRESETS, type Period } from "@/domain/periods";
import { Alert, buttonClass, cx, inputClass } from "@/components/ui/primitives";

/**
 * Period choice for Finances and Expenses: a plain GET form, so it works without JavaScript
 * and the address can be bookmarked. The dates only count for "Custom dates".
 */
export function PeriodPicker({ action, period, children }: { action: string; period: Period; children?: ReactNode }) {
  return (
    <div className="mb-6 space-y-3">
      <form action={action} className="grid gap-3 rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)] p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">Period</span>
          <select name="period" defaultValue={period.preset} className={cx(inputClass, "text-sm")}>
            {PERIOD_PRESETS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">From (custom)</span>
          <input type="date" name="from" defaultValue={period.preset === "custom" ? period.fromKey : ""} className={cx(inputClass, "text-sm")} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">To (custom)</span>
          <input type="date" name="to" defaultValue={period.preset === "custom" ? period.toKey : ""} className={cx(inputClass, "text-sm")} />
        </label>
        {children}
        <button className={buttonClass("night", "md", "w-full lg:w-auto")}>Show</button>
      </form>
      {period.error && (
        <Alert tone="warning" title={period.error}>
          Showing this month instead.
        </Alert>
      )}
    </div>
  );
}
