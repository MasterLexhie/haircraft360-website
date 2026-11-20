import { paystackFeeOnTop } from "@/domain/fees";
import { formatNaira } from "@/lib/money";

/**
 * The Paystack fee the customer pays on top, shown before the popup opens. Renders nothing
 * when the salon bears the fee. The popup shows Paystack's exact total.
 */
export function PaymentFee({
  amountKobo,
  show,
}: {
  amountKobo: number;
  show: boolean;
}) {
  if (!show || amountKobo <= 0) return null;
  const fee = paystackFeeOnTop(amountKobo);
  return (
    <div className="mt-2">
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Paystack payment fee</dt>
          <dd className="tabular text-ink-2">{formatNaira(fee)}</dd>
        </div>
        <div className="flex justify-between gap-4 font-semibold">
          <dt>You pay now</dt>
          <dd className="tabular">{formatNaira(amountKobo + fee)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-xs text-ink-3">
        Paystack adds its fee at checkout and shows the exact total before you
        pay. International cards cost a little more.
      </p>
    </div>
  );
}
