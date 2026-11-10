import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCheckout } from "@/server/queries";
import { MockCheckout } from "@/components/booking/mock-checkout";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Demo checkout" };

export default function CheckoutPage({ params }: { params: Promise<{ reference: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg px-4 py-16"><Skeleton className="h-96" /></div>}>
      <Checkout params={params} />
    </Suspense>
  );
}

async function Checkout({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const data = await getCheckout(reference);
  if (!data) notFound();
  const { payment, booking, accessToken } = data;
  const expired = payment.purpose === "deposit" && booking.status === "expired";
  return (
    <MockCheckout
      reference={payment.reference}
      amountKobo={payment.amountKobo}
      purpose={payment.purpose}
      state={expired ? "abandoned" : payment.state}
      bookingReference={booking.reference}
      accessToken={accessToken}
      holdExpiresAt={payment.purpose === "deposit" ? booking.holdExpiresAt : null}
    />
  );
}
