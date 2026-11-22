import type { ReactNode } from "react";
import { PERIOD_LABELS, PERIOD_PRESETS, type Period } from "@/domain/periods";
import { Alert, buttonClass, cx, inputClass } from "@/components/ui/primitives";

/**
 * Period choice for Finances and Expenses: a plain GET form, so it works without JavaScript
 * and the address can be bookmarked. The date boxes appear only while "Custom dates" is
 * chosen (CSS :has, so no script needed).
 */
export function PeriodPicker({ action, period, children }: { action: string; period: Period; children?: ReactNode }) {
  return (
    <div className="mb-6 space-y-3">
      <form action={action} className="group/period flex flex-wrap items-end gap-3 rounded-[var(--radius)] bg-surface p-4 shadow-[var(--shadow-admin-card)] [&>label]:min-w-[160px] [&>label]:flex-1">
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
        <label className="hidden group-has-[option[value=custom]:checked]/period:block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">From</span>
          <input type="date" name="from" defaultValue={period.preset === "custom" ? period.fromKey : ""} className={cx(inputClass, "text-sm")} />
        </label>
        <label className="hidden group-has-[option[value=custom]:checked]/period:block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">To</span>
          <input type="date" name="to" defaultValue={period.preset === "custom" ? period.toKey : ""} className={cx(inputClass, "text-sm")} />
        </label>
        {children}
        <button className={buttonClass("primary", "md", "w-full sm:w-auto")}>Show</button>
      </form>
      {period.error && (
        <Alert tone="warning" title={period.error}>
          Showing this month instead.
        </Alert>
      )}
    </div>
  );
}
