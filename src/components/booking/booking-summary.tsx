import { CalendarDays, Clock } from "lucide-react";
import type { DepositRule, Kobo, Service } from "@/domain/types";
import { formatNaira } from "@/lib/money";
import { formatDateKey, formatDuration, formatTime } from "@/lib/time";
import { DemoTag } from "@/components/ui/primitives";

export function describeDepositRule(rule: DepositRule): string {
  return rule.type === "percent"
    ? `${rule.percent}% of the estimate, minimum ${formatNaira(rule.minimumKobo)}`
    : `Fixed ${formatNaira(rule.fixedKobo)}`;
}

/** Money rows shared by the wizard summary, review step and confirmation page. */
export function MoneyRows({
  estimateKobo,
  hasUnpriced,
  depositKobo,
  depositLabel = "Deposit due now",
  paidKobo,
  depositIsDemo = true,
}: {
  estimateKobo: Kobo;
  hasUnpriced: boolean;
  depositKobo: Kobo;
  depositLabel?: string;
  paidKobo?: Kobo;
  depositIsDemo?: boolean;
}) {
  const remaining = Math.max(estimateKobo - (paidKobo ?? depositKobo), 0);
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-ink-2">Estimated total</dt>
        <dd className="tabular font-semibold text-ink">
          {formatNaira(estimateKobo)}
          {hasUnpriced && <span className="block text-right text-xs font-normal text-ink-3">+ items priced at appointment</span>}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="flex items-center gap-1.5 text-ink-2">
          {paidKobo !== undefined ? "Paid so far" : depositLabel} {depositIsDemo && paidKobo === undefined && <DemoTag />}
        </dt>
        <dd className="tabular font-semibold text-ink">{formatNaira(paidKobo ?? depositKobo)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
        <dt className="text-ink-2">Estimated remaining after your visit</dt>
        <dd className="tabular font-semibold text-ink">{formatNaira(remaining)}</dd>
      </div>
    </dl>
  );
}

export function BookingSummaryPanel({
  services,
  defaultDuration,
  durationMinutes,
  dateKey,
  startAt,
  estimateKobo,
  hasUnpriced,
  depositKobo,
  depositRule,
}: {
  services: Service[];
  defaultDuration: number;
  durationMinutes: number;
  dateKey: string | null;
  startAt: string | null;
  estimateKobo: Kobo;
  hasUnpriced: boolean;
  depositKobo: Kobo;
  depositRule: DepositRule;
}) {
  return (
    <section aria-labelledby="summary-title" className="overflow-hidden rounded-[var(--radius)] bg-surface p-5 pt-0 shadow-[var(--shadow-sm)] ring-1 ring-line">
      <h2 id="summary-title" className="type-caps -mx-5 mb-1 bg-sand-2 px-5 py-3.5 text-center text-[0.8rem] text-accent-text">Your booking</h2>
      {services.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">No services selected yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {services.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-medium text-ink">{s.name}</span>
                <span className="block text-xs text-ink-3">{formatDuration(s.durationMinutes ?? defaultDuration)}{s.status === "demo" && " · demo service"}</span>
              </span>
              <span className="tabular shrink-0 text-ink-2">{s.priceKobo === null ? "At appointment" : formatNaira(s.priceKobo)}</span>
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
            {services.length > 0 && <span className="text-ink-3"> · about {formatDuration(durationMinutes)}</span>}
          </dd>
        </div>
      </dl>

      {services.length > 0 && (
        <div className="mt-4 rounded-[var(--radius)] bg-sand/70 p-4">
          <MoneyRows estimateKobo={estimateKobo} hasUnpriced={hasUnpriced} depositKobo={depositKobo} />
          <p className="mt-3 text-xs text-ink-3">Demo deposit rule: {describeDepositRule(depositRule)}.</p>
        </div>
      )}
    </section>
  );
}
