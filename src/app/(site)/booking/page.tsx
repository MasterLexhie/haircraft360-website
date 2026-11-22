import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, MapPin, Phone, Receipt } from "lucide-react";
import { SalonPhone } from "@/components/site/salon-phone";
import { FindBookingForm } from "./find-submit";
import { IconTile, Kicker, PageIntro, wrap } from "@/components/site/groove";
import { cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Find my booking" };

export default function FindBookingPage() {
  return (
    <>
      <PageIntro
        kicker="Your appointment"
        title={<>Find your <em>booking</em></>}
        lead="Enter your booking reference and the phone number or email you booked with. No account or password needed."
      />
      <div className={cx(wrap, "grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-16")}>
        <section aria-labelledby="lookup-title" className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow-md)] lg:-mt-24">
          <h2 id="lookup-title" className="border-b border-line px-6 pb-4 pt-6 font-serif text-2xl font-semibold">
            Look up a booking
          </h2>
          <div className="p-6 sm:p-7">
            <FindBookingForm />

            <div className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              <p className="flex items-start gap-2 text-ink-2">
                <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-clay" />
                <span>
                  Lost your reference? Call{" "}
                  <SalonPhone className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent" />.
                </span>
              </p>
              <p className="text-ink-2">
                Not booked yet?{" "}
                <Link href="/book" className="link-caps">
                  Book a visit <ArrowRight aria-hidden className="size-4" />
                </Link>
              </p>
            </div>
          </div>
        </section>

        <div>
          <Kicker>What you can do</Kicker>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { icon: CalendarCheck, title: "Check your appointment", body: "Date, time and whether it’s confirmed." },
              { icon: Receipt, title: "See what you owe", body: "Any balance still due after your deposit." },
              { icon: MapPin, title: "Get directions", body: "The salon’s address and phone number in one place." },
            ].map((f, i) => (
              <li key={f.title}>
                <IconTile icon={f.icon} title={f.title} tone={i % 2 ? "lilac" : "orange"}>
                  {f.body}
                </IconTile>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
