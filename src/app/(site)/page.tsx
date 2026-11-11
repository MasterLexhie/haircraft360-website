import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CalendarCheck, Clock, CreditCard, ExternalLink, MapPin, Navigation, Phone, Scissors, Sparkles } from "lucide-react";
import { business, fullAddress, PREVIEW_MODE } from "@/config/business";
import { getActiveServices, getPublicSettings } from "@/server/queries";
import { HomeServices } from "@/components/site/home-services";
import { StockPhoto } from "@/components/site/brand";
import { GALLERY_PAIRS, HERO_PHOTO } from "@/config/stock-photos";
import { ButtonLink, DemoTag, SectionHeading, Skeleton } from "@/components/ui/primitives";
import { formatHHMM, WEEKDAYS } from "@/lib/time";
import type { DayKey } from "@/domain/types";

export default function HomePage() {
  return (
    <>
      <Hero />
      <PromoBand />
      <Welcome />
      <section id="services" aria-labelledby="services-title" className="scroll-mt-24 bg-bg py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading id="services-title" align="center" title={<>Loc services to <em>book</em> online</>}>
            Compare services side by side and add more than one to the same appointment.
          </SectionHeading>
          <div className="mt-12">
            <Suspense fallback={<ServicesSkeleton />}>
              <ServicesSection />
            </Suspense>
          </div>
        </div>
      </section>
      <Gallery />
      <Visit />
      <ClosingCta />
      <MobileBookBar />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-sand">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:gap-6 md:pb-0 md:pt-0">
        <div className="md:py-20">
          <p className="type-caps flex items-center gap-2 text-[0.72rem] text-ink-3">
            <Scissors aria-hidden className="size-3.5 text-accent-text" />
            Loctician · Ibadan
          </p>
          <h1 id="hero-title" className="type-display mt-5 text-[2.7rem] sm:text-[3.6rem] lg:text-[4rem]">
            Loc care, from your <em>first</em> starter to every retwist.
          </h1>
          <p className="mt-6 max-w-lg text-base text-ink-2 sm:text-lg">
            Pick your services, choose a time that suits you, and reserve your chair online in a few minutes — no account needed.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#services" variant="secondary" size="lg">
              See services
            </ButtonLink>
            <ButtonLink href="/book" size="lg">
              Book appointment
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-4 border-t border-line-strong/60 pt-6 text-sm text-ink-2 sm:grid-cols-2">
            <li className="flex items-start gap-2.5">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
              <span>Basorun Road, Ibadan<br /><span className="text-ink-3">Beside OLAREM filling station</span></span>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
              <span>Mon–Sat, 8 am–9 pm<br /><span className="text-ink-3">Sunday closed{PREVIEW_MODE && " · listed hours"}</span></span>
            </li>
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md self-stretch md:max-w-none">
          <StockPhoto
            photo={HERO_PHOTO}
            label="replace with a Haircraft360 client portrait"
            ratio="4/5"
            sizes="(min-width: 768px) 50vw, 448px"
            priority
            className="h-full w-full md:min-h-[34rem] md:rounded-none"
          />
          <div className="absolute right-4 top-4 rounded-full bg-surface p-1.5 shadow-[var(--shadow-md)] md:right-auto md:top-auto md:bottom-14 md:-left-10 md:p-2">
            <Image
              src="/brand/logo-pink-full.webp"
              alt="Haircraft360 logo: an illustrated woman with a full afro, round glasses and hoop earrings"
              width={569}
              height={571}
              priority
              sizes="(min-width: 768px) 144px, 96px"
              className="size-24 md:size-36"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Full-width plum announcement band. States only what the prototype actually does. */
function PromoBand() {
  return (
    <div className="on-night bg-accent text-on-night">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-center text-[0.72rem] font-semibold uppercase tracking-[0.2em] sm:text-[0.8rem]">
        <span>Reserve your chair online in minutes</span>
        <Sparkles aria-hidden className="size-3.5 text-lilac" />
        <Link href="/book" className="inline-flex min-h-9 items-center text-lilac underline decoration-2 underline-offset-[6px] hover:text-on-night">
          Book now
        </Link>
      </p>
    </div>
  );
}

function Welcome() {
  const steps = [
    { icon: Sparkles, title: "Choose services", body: "Pick one or several — you'll see an estimate as you go." },
    { icon: CalendarCheck, title: "Pick a time", body: "Only times that are actually free are shown." },
    { icon: CreditCard, title: "Reserve with a deposit", body: "A small deposit holds your slot. The rest is settled after." },
  ];
  return (
    <section aria-labelledby="welcome-title" className="overflow-hidden bg-bg">
      <div className="arch-top px-4 pb-16 pt-16 sm:pb-24 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="welcome-title" className="type-caps text-[1.7rem] leading-tight tracking-[0.18em] text-accent-text sm:text-[2.4rem]">
            Welcome to <span className="block">Haircraft360</span>
          </h2>
          <p className="type-caps mt-4 text-[0.8rem] text-ink-2 sm:text-[0.95rem]">How booking works</p>
          <p className="mx-auto mt-4 max-w-xl text-ink-2">
            Three short steps, from choosing your services to a confirmed appointment.
          </p>
        </div>
        <ol className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-[var(--radius)] bg-surface p-6 text-center shadow-[var(--shadow-sm)]">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft">
                <s.icon aria-hidden className="size-5 text-accent-text" />
              </span>
              <p className="mt-4 font-display text-lg italic text-accent-text">
                <span className="sr-only">Step </span>0{i + 1}
              </p>
              <p className="type-caps mt-1 text-[0.8rem] text-accent-text">{s.title}</p>
              <p className="mt-2 text-sm text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-ink-3">
          Prototype: the deposit amount is a demo rule and checkout is simulated. Real deposit and cancellation terms are awaiting the owner.
        </p>
      </div>
    </section>
  );
}

async function ServicesSection() {
  const [services, settings] = await Promise.all([getActiveServices(), getPublicSettings()]);
  if (services.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-line-strong p-8 text-center">
        <p className="font-semibold">Services are being updated.</p>
        <p className="mt-1 text-sm text-ink-2">
          Call <a className="font-semibold underline" href={`tel:${business.phone.value.e164}`}>{business.phone.value.display}</a> to ask about an appointment.
        </p>
      </div>
    );
  }
  return <HomeServices services={services} defaultDuration={settings.availability.defaultDurationMinutes} />;
}

function ServicesSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2" role="status" aria-label="Loading services">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-96" />
      ))}
    </div>
  );
}

function Gallery() {
  return (
    <section aria-labelledby="gallery-title" className="bg-sand py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="gallery-title" align="center" title={<>Loc work, <em>before &amp; after</em></>}>
          Stock photos show the kind of shots this gallery needs. Each pair is two different people, not a real
          before and after. They will be replaced with Haircraft360 clients once photos are supplied and approved.
        </SectionHeading>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {GALLERY_PAIRS.map(({ label, before, after }) => (
            <li key={label} className="bg-surface shadow-[var(--shadow-sm)]">
              <p className="type-caps flex items-center justify-center gap-2 bg-sand-2 px-4 py-4 text-center text-[0.8rem] text-accent-text">
                {label} <DemoTag>Stock stand-in</DemoTag>
              </p>
              <div className="grid grid-cols-2 gap-1 p-1">
                <StockPhoto photo={before} label="before" ratio="3/4" sizes="(min-width: 768px) 17vw, 50vw" className="rounded-none" />
                <StockPhoto photo={after} label="after" ratio="3/4" sizes="(min-width: 768px) 17vw, 50vw" className="rounded-none" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Visit() {
  return (
    <section id="visit" aria-labelledby="visit-title" className="scroll-mt-24 bg-bg py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="visit-title" align="center" title={<>Find the <em>salon</em></>}>
          On Basorun Road in Ibadan, beside the OLAREM filling station.
        </SectionHeading>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="bg-sand-2 p-6 sm:p-10">
            <h3 className="type-caps text-[0.85rem] text-accent-text">Address &amp; contact</h3>
            <dl className="mt-6 space-y-6">
              <div className="flex gap-4">
                <dt className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface">
                  <MapPin aria-hidden className="size-5 text-accent-text" />
                  <span className="sr-only">Address</span>
                </dt>
                <dd>
                  <address className="not-italic text-ink">{fullAddress}</address>
                  <a href={business.mapsUrl} target="_blank" rel="noopener noreferrer" className="link-caps mt-1">
                    <Navigation aria-hidden className="size-4" /> Get directions
                    <ExternalLink aria-hidden className="size-3.5" />
                    <span className="sr-only">on Google Maps (opens in a new tab)</span>
                  </a>
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface">
                  <Phone aria-hidden className="size-5 text-accent-text" />
                  <span className="sr-only">Phone</span>
                </dt>
                <dd>
                  <a href={`tel:${business.phone.value.e164}`} className="inline-flex min-h-11 items-center font-display text-2xl text-accent-text underline decoration-line-strong decoration-1 underline-offset-[6px] hover:decoration-accent">
                    {business.phone.value.display}
                  </a>
                  <p className="text-sm text-ink-3">Tap to call</p>
                </dd>
              </div>
            </dl>
            {PREVIEW_MODE && (
              <p className="mt-8 border-t border-line-strong/70 pt-4 text-xs text-ink-2">
                Address, phone and hours are from a public Google listing (record fetched 14 Sep 2026) and are awaiting confirmation by the owner.
              </p>
            )}
          </div>

          <div className="border border-line bg-surface p-6 sm:p-10">
            <h3 className="type-caps flex items-center gap-2 text-[0.85rem] text-accent-text">
              <Clock aria-hidden className="size-4" /> Opening hours
            </h3>
            <Suspense fallback={<Skeleton className="mt-6 h-56" />}>
              <HoursTable />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}

async function HoursTable() {
  const { availability, availabilityStatus } = await getPublicSettings();
  const order: DayKey[] = [1, 2, 3, 4, 5, 6, 0];
  return (
    <>
      <table className="mt-6 w-full text-left text-sm">
        <caption className="sr-only">Opening hours by day</caption>
        <tbody>
          {order.map((d) => {
            const h = availability.weeklyHours[d];
            return (
              <tr key={d} className="border-b border-line last:border-0">
                <th scope="row" className="py-3 font-semibold text-ink">{WEEKDAYS[d]}</th>
                <td className={h ? "py-3 text-right tabular text-ink-2" : "py-3 text-right font-display italic text-ink-3"}>
                  {h ? `${formatHHMM(h.open)} – ${formatHHMM(h.close)}` : "Closed"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {availabilityStatus === "demo" && (
        <p className="mt-4 text-xs text-ink-3">Listed hours — not yet confirmed. Public-holiday hours have not been supplied.</p>
      )}
    </>
  );
}

function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="on-night bg-night text-on-night">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-28 pt-16 text-center sm:px-6 md:py-20">
        <p className="type-caps text-[0.72rem] text-lilac">Haircraft360 · Ibadan</p>
        <h2 id="cta-title" className="mt-4 font-display text-[2.2rem] font-light leading-tight sm:text-5xl">
          Ready for your next <em className="text-lilac">loc appointment?</em>
        </h2>
        <p className="mt-4 text-on-night-2">See real-time availability and reserve in a few steps.</p>
        <ButtonLink href="/book" variant="light" size="lg" className="mt-8">
          Book appointment <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
    </section>
  );
}

/** Small sticky booking bar on phones. The section above reserves bottom space so it never hides content. */
function MobileBookBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <ButtonLink href="/book" size="lg" className="w-full">
        Book appointment
      </ButtonLink>
    </div>
  );
}
