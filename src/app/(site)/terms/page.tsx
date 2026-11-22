import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublicSettings } from "@/server/queries";
import { describeDepositRule } from "@/components/booking/booking-summary";
import { Skeleton } from "@/components/ui/primitives";
import { PageIntro } from "@/components/site/groove";

export const metadata: Metadata = { title: "Booking terms" };

/**
 * Booking terms shown before paying (FINAL_PLAN item 36). The deposit and hold wording is
 * read from Settings so it always matches what the booking form charges.
 * PLACEHOLDER WORDING: the owner must check this page before launch (task E4).
 */
export default function TermsPage() {
  return (
    <>
      <PageIntro kicker="Before you book" title={<>Booking <em>terms</em></>} lead="What the deposit covers, how we hold your time and how the balance works." />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-[var(--radius)] border border-line bg-surface p-6 shadow-[var(--shadow-md)] sm:p-10">
          <Suspense fallback={<Skeleton className="h-64" />}>
            <Terms />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function Terms() {
  const settings = await getPublicSettings();
  const { holdMinutes } = settings.availability;
  return (
    <div className="space-y-8 text-ink-2 [&_h2]:font-serif [&_h2]:text-[1.4rem] [&_h2]:font-semibold [&_h2]:text-ink">
      <section>
        <h2>Deposit</h2>
        <p className="mt-2">
          A deposit secures your appointment: {describeDepositRule(settings.deposit)}. <strong className="text-ink">The deposit is not refundable.</strong> If
          you can&apos;t make it, contact the salon before your appointment and they will help you move to another time.
        </p>
      </section>
      <section>
        <h2>Holding your time</h2>
        <p className="mt-2">
          When you reach the payment step, your time is held for {holdMinutes} minutes. If the deposit isn&apos;t paid in that time, the time is released
          for other customers. If your payment arrives after someone else has taken the time, the salon will contact you to choose a new time.
        </p>
      </section>
      <section>
        <h2>The balance</h2>
        <p className="mt-2">
          The rest of the price is paid at or after your appointment. Anything added on the day, such as an extra service, is added to the balance.
        </p>
      </section>
      <section>
        <h2>Your details</h2>
        <p className="mt-2">
          Your name, phone number and email are used only to manage your appointments and send your confirmation and reminder. Offers and news are
          only sent if you said yes when booking.
        </p>
      </section>
    </div>
  );
}
