import type { Metadata } from "next";
import { Suspense } from "react";
import { getBookingConfig } from "@/server/queries";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { Skeleton } from "@/components/ui/primitives";
import { business } from "@/config/business";

export const metadata: Metadata = { title: "Book an appointment" };

export default function BookPage({ searchParams }: { searchParams: Promise<{ services?: string }> }) {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      <Wizard searchParams={searchParams} />
    </Suspense>
  );
}

async function Wizard({ searchParams }: { searchParams: Promise<{ services?: string }> }) {
  const [{ services, settings }, params] = await Promise.all([getBookingConfig(), searchParams]);
  const initial = (params.services ?? "").split(",").filter(Boolean);
  if (services.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="type-display text-[2.2rem]">Online booking is paused</h1>
        <p className="mt-3 text-ink-2">
          No services are open for booking right now. Please call{" "}
          <a className="font-semibold underline" href={`tel:${business.phone.value.e164}`}>{business.phone.value.display}</a>.
        </p>
      </div>
    );
  }
  return <BookingWizard services={services} settings={settings} initialSelected={initial} />;
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
