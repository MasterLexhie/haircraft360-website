import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CreditCard, MapPin, Phone, Receipt } from "lucide-react";
import { business, PREVIEW_MODE } from "@/config/business";
import { FindSubmit } from "./find-submit";
import { findBookingForCustomer } from "@/server/queries";
import { Alert, DemoTag, Field, inputClass } from "@/components/ui/primitives";

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
    <div className="bg-sand">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-16 lg:gap-y-10">
        {/* Intro: first on every screen size */}
        <div className="lg:col-start-1 lg:row-start-1 lg:pt-6">
          <p className="type-caps text-[0.72rem] text-ink-3">Your appointment</p>
          <h1 className="type-display mt-3 text-[2.4rem] sm:text-[3.25rem]">
            Find your <em>booking</em>
          </h1>
          <p className="mt-4 max-w-md text-ink-2">
            Enter your booking reference and the phone number or email you booked with. No account or password needed.
          </p>
        </div>

        {/* Lookup card */}
        <section aria-labelledby="lookup-title" className="lg:col-start-2 lg:row-span-2 lg:row-start-1 overflow-hidden rounded-[var(--radius)] bg-surface shadow-[var(--shadow-md)]">
          <h2 id="lookup-title" className="type-caps bg-sand-2 px-6 py-4 text-center text-[0.8rem] text-accent-text">
            Look up a booking
          </h2>
          <div className="p-6 sm:p-7">
            {notfound && (
              <Alert tone="danger" role="alert" className="mb-6" title="We couldn’t find a booking with those details">
                Check the reference and use the same phone number or email you booked with.
              </Alert>
            )}
            <form action={lookup} className="space-y-5">
              <Field id="reference" label="Booking reference" required hint="Starts with HC-, e.g. HC-7KQ2M. It’s on your confirmation page.">
                <input
                  id="reference"
                  name="reference"
                  required
                  defaultValue={ref ?? ""}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="HC-"
                  aria-describedby="reference-hint"
                  aria-invalid={notfound ? true : undefined}
                  className={`${inputClass} font-semibold uppercase tracking-[0.12em] tabular`}
                />
              </Field>
              <Field id="contact" label="Phone number or email" required hint="The one you used when you booked.">
                <input
                  id="contact"
                  name="contact"
                  required
                  autoComplete="on"
                  aria-describedby="contact-hint"
                  aria-invalid={notfound ? true : undefined}
                  placeholder="0803 123 4567 or you@example.com"
                  className={inputClass}
                />
              </Field>
              <FindSubmit />
            </form>

            <div className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              <p className="flex items-start gap-2 text-ink-2">
                <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
                <span>
                  Lost your reference? Call the salon on{" "}
                  <a href={`tel:${business.phone.value.e164}`} className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
                    {business.phone.value.display}
                  </a>
                  .
                </span>
              </p>
              <p className="text-ink-2">
                Not booked yet?{" "}
                <Link href="/book" className="link-caps">
                  Book an appointment <ArrowRight aria-hidden className="size-4" />
                </Link>
              </p>
            </div>
          </div>
          {PREVIEW_MODE && (
            <p className="flex items-center gap-2 border-t border-dashed border-line-strong bg-sand/50 px-6 py-3 text-xs text-ink-3">
              <DemoTag>Demo</DemoTag> Try HC-DEMO2 with phone 0800 000 0002.
            </p>
          )}
        </section>

        {/* What you can do: after the form on phones, under the intro on desktop */}
        <div className="lg:col-start-1 lg:row-start-2">
          <ul className="grid max-w-lg gap-5 sm:grid-cols-2">
            {[
              { icon: CalendarCheck, title: "Check your appointment", body: "Date, time, services and the salon’s notes." },
              { icon: Receipt, title: "See what you’ve paid", body: "Deposit, payments so far and any balance due." },
              { icon: CreditCard, title: "Pay online", body: "Pay a deposit or balance through the demo checkout." },
              { icon: MapPin, title: "Get directions", body: "The salon’s address and phone number in one place." },
            ].map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-accent-text shadow-[var(--shadow-sm)]">
                  <f.icon aria-hidden className="size-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{f.title}</span>
                  <span className="block text-sm text-ink-2">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
