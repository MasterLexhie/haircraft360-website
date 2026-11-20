import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, MapPin, Phone, Receipt } from "lucide-react";
import { SalonPhone } from "@/components/site/salon-phone";
import { FindBookingForm } from "./find-submit";

export const metadata: Metadata = { title: "Find my booking" };

export default function FindBookingPage() {
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
            <FindBookingForm />

            <div className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              <p className="flex items-start gap-2 text-ink-2">
                <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
                <span>
                  Lost your reference? Call{" "}
                  <SalonPhone className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent" />.
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
        </section>

        {/* What you can do: after the form on phones, under the intro on desktop */}
        <div className="lg:col-start-1 lg:row-start-2">
          <ul className="grid max-w-lg gap-5 sm:grid-cols-2">
            {[
              { icon: CalendarCheck, title: "Check your appointment", body: "Date, time and whether it’s confirmed." },
              { icon: Receipt, title: "See what you owe", body: "Any balance still due after your deposit." },
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
