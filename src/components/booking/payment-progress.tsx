import type { PaymentPhase } from "./use-paystack-payment";
import { Alert } from "@/components/ui/primitives";

/** Says what's happening while a payment is open or being confirmed. */
export function PaymentProgress({ phase }: { phase: PaymentPhase }) {
  if (phase === "confirming") {
    return (
      <Alert tone="info" role="status" title="Confirming your payment">
        This usually takes a few seconds. Please keep this page open.
      </Alert>
    );
  }
  return <p role="status" className="sr-only">{phase === "starting" ? "Opening the payment window" : phase === "open" ? "Payment window open" : ""}</p>;
}
