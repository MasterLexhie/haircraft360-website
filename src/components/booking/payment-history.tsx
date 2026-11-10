import type { Payment } from "@/domain/types";
import { paymentPurposeLabel, paymentStateLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Badge } from "@/components/ui/primitives";

/** Every payment attempt listed once, oldest first. Shared by customer and admin views. */
export function PaymentHistory({ payments, showReference = true }: { payments: Payment[]; showReference?: boolean }) {
  if (payments.length === 0) return <p className="text-sm text-ink-3">No payments yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {payments.map((p) => {
        const state = paymentStateLabel[p.state];
        return (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-ink">
                {paymentPurposeLabel[p.purpose]}
                {p.source === "manual_entry" ? ` · ${p.method ?? "manual"}` : " · mock checkout"}
              </p>
              <p className="text-xs text-ink-3">
                {formatDateTime(p.resolvedAt ?? p.createdAt)}
                {showReference && <> · <span className="break-all">{p.reference}</span></>}
              </p>
              {p.source === "manual_entry" && <p className="text-xs text-ink-3">Recorded manually by the salon — not gateway-verified.</p>}
              {p.note && <p className="text-xs text-ink-3">{p.note}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className={`tabular font-semibold ${p.state === "success" ? "text-ink" : "text-ink-3 line-through decoration-ink-3/50"}`}>
                {formatNaira(p.amountKobo)}
              </span>
              <Badge tone={state.tone}>{state.label}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
