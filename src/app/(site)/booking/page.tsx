import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { findBookingForCustomer } from "@/server/queries";
import { Alert, Button, Field, inputClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Find my booking" };

async function lookup(formData: FormData) {
  "use server";
  const reference = String(formData.get("reference") ?? "");
  const contact = String(formData.get("contact") ?? "");
  const found = reference && contact ? await findBookingForCustomer(reference, contact) : null;
  if (!found) redirect(`/booking?notfound=1&ref=${encodeURIComponent(reference.slice(0, 12))}`);
  redirect(`/booking/${found.reference}?t=${encodeURIComponent(found.token)}`);
}

type SP = Promise<{ notfound?: string; ref?: string }>;

export default function FindBookingPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense>
      <FindBooking searchParams={searchParams} />
    </Suspense>
  );
}

async function FindBooking({ searchParams }: { searchParams: SP }) {
  const { notfound, ref } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <h1 className="type-display text-[2.2rem] sm:text-[2.75rem]">Find my booking</h1>
      <p className="mt-2 text-ink-2">See your appointment, payment history and any balance due.</p>
      {notfound && (
        <Alert tone="danger" role="alert" className="mt-6" title="We couldn't find a booking with those details">
          Check the reference (it looks like HC-7KQ2M) and use the same phone number or email you booked with.
        </Alert>
      )}
      <form action={lookup} className="mt-8 space-y-5">
        <Field id="reference" label="Booking reference" required>
          <input id="reference" name="reference" required defaultValue={ref ?? ""} autoCapitalize="characters" autoComplete="off" placeholder="HC-" className={`${inputClass} uppercase`} />
        </Field>
        <Field id="contact" label="Phone number or email used to book" required>
          <input id="contact" name="contact" required autoComplete="tel" className={inputClass} />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          <Search aria-hidden className="size-4" /> Find booking
        </Button>
      </form>
      <p className="mt-6 text-xs text-ink-3">Demo tip: seeded booking HC-DEMO2 uses phone 0800 000 0002.</p>
    </div>
  );
}
