import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getMockCheckout } from "@/server/payments/mock";
import { MockCheckout } from "@/components/booking/mock-checkout";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string }> };

/** DEVELOPMENT ONLY mock checkout (ENABLE_MOCK_CHECKOUT). Replaced by the Paystack popup in Milestone 4. */
export default function CheckoutPage(props: Props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg px-4 py-16"><Skeleton className="h-96" /></div>}>
      <Checkout {...props} />
    </Suspense>
  );
}

async function Checkout({ params, searchParams }: Props) {
  await connection();
  const [{ reference }, { t }] = await Promise.all([params, searchParams]);
  const data = await getMockCheckout(reference, t ?? "");
  if (!data) notFound();
  const expired = data.purpose === "deposit" && data.bookingStatus === "expired";
  return (
    <MockCheckout
      reference={data.reference}
      amountKobo={data.amountKobo}
      purpose={data.purpose}
      state={expired ? "abandoned" : data.status}
      bookingReference={data.bookingReference}
      accessToken={t!}
      holdExpiresAt={data.purpose === "deposit" ? data.holdExpiresAt : null}
    />
  );
}
