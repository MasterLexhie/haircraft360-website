import { CalendarDays, Clock } from "lucide-react";
import type { DepositRule } from "@/domain/deposit";
import type { Kobo } from "@/domain/types";
import { formatNaira } from "@/lib/money";
import { formatDateKey, formatDuration, formatTime } from "@/lib/time";

export function describeDepositRule(rule: DepositRule): string {
  const base = rule.scope === "main_only" ? "the main service" : "the total";
  if (rule.type === "fixed") return `${formatNaira(rule.fixedKobo)} to secure your time`;
  const min = rule.minimumKobo ? `, minimum ${formatNaira(rule.minimumKobo)}` : "";
  return `${rule.percent}% of ${base}${min}`;
}

export interface SummaryLine {
  key: string;
  name: string;
  priceKobo: Kobo;
  durationMinutes: number;
  isAddOn?: boolean;
}

/** Money rows shared by the wizard summary, review step and confirmation page. */
export function MoneyRows({
  totalKobo,
  depositKobo,
  paidKobo,
}: {
  totalKobo: Kobo;
  depositKobo: Kobo;
  /** When given (after booking), shows what has been paid instead of the deposit due. */
  paidKobo?: Kobo;
}) {
  const paidOrDue = paidKobo ?? depositKobo;
  const remaining = Math.max(totalKobo - paidOrDue, 0);
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-ink-2">Total</dt>
        <dd className="tabular font-semibold text-ink">{formatNaira(totalKobo)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-ink-2">{paidKobo !== undefined ? "Paid so far" : "Deposit due now"}</dt>
        <dd className="tabular font-semibold text-ink">{formatNaira(paidOrDue)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
        <dt className="text-ink-2">Balance due at the salon</dt>
        <dd className="tabular font-semibold text-ink">{formatNaira(remaining)}</dd>
      </div>
    </dl>
  );
}

export function BookingSummaryPanel({
  lines,
  durationMinutes,
  dateKey,
  startAt,
  totalKobo,
  depositKobo,
  depositRule,
}: {
  lines: SummaryLine[];
  durationMinutes: number;
  dateKey: string | null;
  startAt: string | null;
  totalKobo: Kobo;
  depositKobo: Kobo;
  depositRule: DepositRule;
}) {
  return (
    <section aria-labelledby="summary-title" className="overflow-hidden rounded-[var(--radius)] bg-surface p-5 pt-0 shadow-[var(--shadow-sm)] ring-1 ring-line">
      <h2 id="summary-title" className="type-caps -mx-5 mb-1 bg-sand-2 px-5 py-3.5 text-center text-[0.8rem] text-accent-text">Your booking</h2>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">No service selected yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {lines.map((l) => (
            <li key={l.key} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-medium text-ink">{l.isAddOn && <span className="text-ink-3">+ </span>}{l.name}</span>
                <span className="block text-xs text-ink-3">{formatDuration(l.durationMinutes)}</span>
              </span>
              <span className="tabular shrink-0 text-ink-2">{formatNaira(l.priceKobo)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
        <div className="flex items-center gap-2 text-ink-2">
          <dt><CalendarDays aria-hidden className="size-4" /><span className="sr-only">Date</span></dt>
          <dd>{dateKey ? formatDateKey(dateKey) : "Date not chosen"}</dd>
        </div>
        <div className="flex items-center gap-2 text-ink-2">
          <dt><Clock aria-hidden className="size-4" /><span className="sr-only">Time</span></dt>
          <dd>
            {startAt ? formatTime(startAt) : "Time not chosen"}
            {lines.length > 0 && <span className="text-ink-3"> · about {formatDuration(durationMinutes)}</span>}
          </dd>
        </div>
      </dl>

      {lines.length > 0 && (
        <div className="mt-4 rounded-[var(--radius)] bg-sand/70 p-4">
          <MoneyRows totalKobo={totalKobo} depositKobo={depositKobo} />
          <p className="mt-3 text-xs text-ink-3">Deposit: {describeDepositRule(depositRule)}.</p>
        </div>
      )}
    </section>
  );
}
