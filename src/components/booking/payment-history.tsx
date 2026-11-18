import type { Payment } from "@/domain/types";
import { paymentMethodLabel, paymentTypeLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Badge } from "@/components/ui/primitives";

/** Ledger rows, oldest first. Shared by customer and admin views. */
export function PaymentHistory({ payments, showReference = true }: { payments: Payment[]; showReference?: boolean }) {
  if (payments.length === 0) return <p className="text-sm text-ink-3">No payments yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {payments.map((p) => {
        const ok = p.status === "success";
        return (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-ink">
                {paymentTypeLabel[p.type]} · {paymentMethodLabel[p.method]}
              </p>
              <p className="text-xs text-ink-3">
                {formatDateTime(p.createdAt)}
                {showReference && p.paystackReference && <> · <span className="break-all">{p.paystackReference}</span></>}
                {p.recordedByName && <> · recorded by {p.recordedByName}</>}
              </p>
              {p.note && <p className="text-xs text-ink-3">{p.note}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className={`tabular font-semibold ${ok ? "text-ink" : "text-ink-3 line-through decoration-ink-3/50"}`}>{formatNaira(p.amountKobo)}</span>
              <Badge tone={ok ? "success" : "danger"}>{ok ? "Received" : "Failed"}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
