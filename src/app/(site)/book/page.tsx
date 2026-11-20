import type { Metadata } from "next";
import { Suspense } from "react";
import { getBookingConfig, getSalon } from "@/server/queries";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { Skeleton } from "@/components/ui/primitives";
import { SalonPhone } from "@/components/site/salon-phone";
import { customerPaysFees } from "@/server/payments/paystack";

export const metadata: Metadata = { title: "Book an appointment" };

export default function BookPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      <Wizard searchParams={searchParams} />
    </Suspense>
  );
}

async function Wizard({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const [{ services, settings }, params, salon] = await Promise.all([getBookingConfig(), searchParams, getSalon()]);
  if (!services.some((s) => s.bookableAlone)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="type-display text-[2.2rem]">Online booking is paused</h1>
        <p className="mt-3 text-ink-2">
          No services are open for booking right now. Please call{" "}
          <SalonPhone />.
        </p>
      </div>
    );
  }
  return <BookingWizard services={services} settings={{ availability: settings.availability, deposit: settings.deposit }} initialServiceId={params.service ?? null} customerPaysFees={customerPaysFees()} salonPhone={salon.phone} />;
}

function WizardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" role="status" aria-label="Loading booking">
      <Skeleton className="h-8 w-full max-w-lg" />
      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="hidden h-80 md:block" />
      </div>
    </div>
  );
}
