"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Alert, Button } from "@/components/ui/primitives";

/** Opens (or reuses) a demo checkout for the deposit or the outstanding balance. */
export function PayButton({ reference, token, purpose, label }: { reference: string; token: string; purpose: "deposit" | "balance"; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${reference}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, purpose }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Couldn't open checkout.");
        router.refresh();
        return;
      }
      router.push(`/checkout/${data.checkoutReference}`);
    } catch {
      setError("We couldn't reach the checkout service. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Button size="lg" className="w-full sm:w-auto" onClick={go} loading={busy}>
        <CreditCard aria-hidden className="size-5" /> {label}
      </Button>
      {error && <Alert tone="danger" role="alert" title={error} />}
    </div>
  );
}
