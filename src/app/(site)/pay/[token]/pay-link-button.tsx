"use client";

import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { startPayment, usePaystackPayment } from "@/components/booking/use-paystack-payment";
import { PaymentProgress } from "@/components/booking/payment-progress";
import { Alert, Button } from "@/components/ui/primitives";

export function PayLinkButton({ token, label }: { token: string; label: string }) {
  const router = useRouter();
  const { pay, phase, error } = usePaystackPayment((outcome) => {
    if (outcome === "cancelled" || outcome === "error" || outcome === "failed") return;
    if (outcome === "pending") router.replace(`?paid=pending`, { scroll: false });
    router.refresh();
  });
  return (
    <div className="space-y-3">
      <Button size="lg" className="w-full" onClick={() => pay(() => startPayment("/api/pay", { token }))} loading={phase !== "idle"}>
        <CreditCard aria-hidden className="size-5" /> {label}
      </Button>
      <PaymentProgress phase={phase} />
      {error && <Alert tone="danger" role="alert" title={error} />}
    </div>
  );
}
