"use client";

import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { startPayment, usePaystackPayment } from "@/components/booking/use-paystack-payment";
import { PaymentProgress } from "@/components/booking/payment-progress";
import { Alert, Button } from "@/components/ui/primitives";

/** Pays the deposit or the balance from the customer's booking page. Each press opens a fresh transaction. */
export function PayButton({ reference, token, purpose, label }: { reference: string; token: string; purpose: "deposit" | "balance"; label: string }) {
  const router = useRouter();
  const { pay, phase, error } = usePaystackPayment((outcome) => {
    if (outcome === "cancelled" || outcome === "error") return;
    // The booking cookie already opens this page, so the address stays free of the token.
    router.replace(`/booking/${reference}${outcome === "paid" ? `?paid=${purpose}` : outcome === "pending" ? "?paid=pending" : ""}`, { scroll: false });
    router.refresh();
  });
  return (
    <div className="space-y-3">
      <Button size="lg" className="w-full sm:w-auto" onClick={() => pay(() => startPayment(`/api/bookings/${reference}/checkout`, { token, purpose }))} loading={phase !== "idle"}>
        <CreditCard aria-hidden className="size-5" /> {label}
      </Button>
      <PaymentProgress phase={phase} />
      {error && <Alert tone="danger" role="alert" title={error} />}
    </div>
  );
}
