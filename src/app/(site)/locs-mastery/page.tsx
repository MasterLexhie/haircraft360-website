import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, BookOpen, CalendarClock, Check, ClipboardList, GraduationCap, HandHeart, MessageCircle, Ruler, Scissors, ShieldCheck, Sparkles, Store, Wallet, Wrench } from "lucide-react";
import { latestBirthDate } from "@/domain/academy";
import { formatNaira } from "@/lib/money";
import { lagosDateKey } from "@/lib/time";
import { listPublicPrograms, type ProgramRow } from "@/server/academy";
import { requestNow } from "@/server/queries";
import { StockPhoto } from "@/components/site/brand";
import { ACADEMY_PHOTOS } from "@/config/stock-photos";
import { Badge, ButtonLink, SectionHeading, Skeleton } from "@/components/ui/primitives";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Locs Mastery programs",
  description: "Hands-on loc training in Ibadan, from starting locs to styling and running a loc business. Free to apply online.",
};

type Props = { searchParams: Promise<{ program?: string }> };

export default function LocsMasteryPage({ searchParams }: Props) {
  return (
    <>
      <Hero />
      <Band />
      <Learn />
      <section id="programs" aria-labelledby="programs-title" className="scroll-mt-24 bg-sand py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading id="programs-title" eyebrow="The programs" title={<>Find the program that <em>fits</em> you</>}>
            Each program is taught hands on. Dates and what to bring are talked through with you after you apply.
          </SectionHeading>
          <Suspense fallback={<ProgramsSkeleton />}>
            <Programs />
          </Suspense>
        </div>
      </section>
      <HowToApply />
      <section id="apply" aria-labelledby="apply-title" className="scroll-mt-20 bg-sand py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <SectionHeading id="apply-title" eyebrow="Apply" title={<>Apply in about <em>five minutes</em></>}>
              Tell us who you are and why you want to learn. It&apos;s free, and there&apos;s no commitment until you&apos;ve spoken to us.
            </SectionHeading>
            <StockPhoto photo={ACADEMY_PHOTOS.apply} label="replace with a past student at work" ratio="4/3" sizes="(min-width: 1024px) 40vw, 100vw" className="mt-8 hidden lg:block" />
            <WhatWeAsk />
          </div>
          <Suspense fallback={<Skeleton className="h-[52rem]" />}>
            <Apply searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
      <Faq />
      <Closing />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="lm-hero-title" className="relative overflow-hidden bg-sand">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:gap-8 md:pb-20 md:pt-20">
        <div>
          <p className="type-caps flex items-center gap-2 text-[0.72rem] text-ink-3">
            <GraduationCap aria-hidden className="size-4 text-accent-text" />
            Locs Mastery · Training in Ibadan
          </p>
          <h1 id="lm-hero-title" className="type-display mt-5 text-[2.6rem] sm:text-[3.4rem] lg:text-[3.8rem]">
            Learn the craft of <em>locs</em>, hands on.
          </h1>
          <p className="mt-6 max-w-lg text-base text-ink-2 sm:text-lg">
            Whether you&apos;ve never started a loc or you already have clients in your chair, our programs teach the skills that keep clients coming back: clean
            parts, neat retwists, healthy scalps and styles people ask about.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#programs" variant="secondary" size="lg">
              See the programs
            </ButtonLink>
            <ButtonLink href="#apply" size="lg">
              Apply now <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </div>
        <StockPhoto photo={ACADEMY_PHOTOS.hero} label="replace with the tutor teaching" ratio="4/3" sizes="(min-width: 768px) 45vw, 100vw" priority />
      </div>
    </section>
  );
}

function Band() {
  const points = ["Learn by doing", "Beginner to working stylist", "Free to apply"];
  return (
    <div className="on-night bg-accent text-on-night">
      <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-4 text-center text-[0.72rem] font-semibold uppercase tracking-[0.2em] sm:text-[0.8rem]">
        {points.map((p, i) => (
          <li key={p} className="flex items-center gap-6">
            {i > 0 && <Sparkles aria-hidden className="size-3.5 text-lilac" />}
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SKILLS = [
  { icon: ClipboardList, title: "Consultation and scalp health", body: "Read hair type, density and scalp condition, and set honest expectations with every client." },
  { icon: Ruler, title: "Parting and starting locs", body: "Section cleanly and start locs with comb coils, two-strand twists and interlocking." },
  { icon: Scissors, title: "Retwists and maintenance", body: "Palm rolling and interlocking maintenance that keeps roots neat for longer." },
  { icon: Wrench, title: "Repairs", body: "Fix thinning, weak and combined locs, and add length with extensions." },
  { icon: Sparkles, title: "Styling", body: "Updos, barrels, petals and everyday styles that are kind to the hair." },
  { icon: Store, title: "Client care and business", body: "Aftercare advice, pricing, bookings and photos that bring in new clients." },
];

function Learn() {
  return (
    <section aria-labelledby="learn-title" className="overflow-hidden bg-bg">
      <div className="arch-top px-4 pb-16 pt-16 sm:pb-24 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="learn-title" className="type-caps text-[1.5rem] leading-tight tracking-[0.18em] text-accent-text sm:text-[2.2rem]">
            What you could <span className="block">learn</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-2">Every program covers some of these. Each one below lists exactly what it teaches.</p>
        </div>
        <ul className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((s) => (
            <li key={s.title} className="rounded-[var(--radius)] bg-surface p-6 shadow-[var(--shadow-sm)]">
              <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft">
                <s.icon aria-hidden className="size-5 text-accent-text" />
              </span>
              <h3 className="type-caps mt-4 text-[0.8rem] text-accent-text">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-2">{s.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

async function Programs() {
  const programs = await listPublicPrograms();
  if (programs.length === 0) {
    return (
      <div className="mt-10 rounded-[var(--radius)] border border-dashed border-line-strong bg-surface p-8 text-center">
        <p className="font-semibold">New programs are being planned.</p>
        <p className="mt-1 text-sm text-ink-2">Check back soon.</p>
      </div>
    );
  }
  return (
    <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {programs.map((p, i) => (
        <li key={p.id}>
          <ProgramCard program={p} photoIndex={i} />
        </li>
      ))}
    </ul>
  );
}

function ProgramCard({ program: p, photoIndex }: { program: ProgramRow; photoIndex: number }) {
  const photo = ACADEMY_PHOTOS.programs[photoIndex % ACADEMY_PHOTOS.programs.length]!;
  return (
    <article aria-labelledby={`prog-${p.id}`} className="flex h-full flex-col overflow-hidden rounded-[var(--radius)] bg-surface shadow-[var(--shadow-sm)]">
      <StockPhoto photo={photo} ratio="16/9" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" className="rounded-none" />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap gap-2">
          {p.level && <Badge tone="accent">{p.level}</Badge>}
          {p.acceptingApplications ? <Badge tone="success">Open for applications</Badge> : <Badge tone="neutral">Next intake soon</Badge>}
        </div>
        <h3 id={`prog-${p.id}`} className="type-display mt-4 text-[1.6rem]">{p.name}</h3>
        <p className="mt-2 text-sm text-ink-2">{p.summary}</p>
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            <dt className="sr-only">Length</dt>
            <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
            <dd className="text-ink">{p.duration}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="sr-only">Fee</dt>
            <Wallet aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
            <dd className={p.priceKobo === null ? "text-ink-2" : "font-semibold text-ink"}>{p.priceKobo === null ? "Fee shared after you apply" : formatNaira(p.priceKobo)}</dd>
          </div>
          {p.format && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Where and when</dt>
              <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
              <dd className="text-ink">{p.format}</dd>
            </div>
          )}
        </dl>
        <h4 className="type-caps mt-5 text-[0.72rem] text-ink-3">What you&apos;ll learn</h4>
        <ul className="mt-2 flex-1 space-y-2 text-sm text-ink-2">
          {p.outcomes.map((o) => (
            <li key={o} className="flex items-start gap-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              {o}
            </li>
          ))}
        </ul>
        {p.acceptingApplications ? (
          <ButtonLink href={`/locs-mastery?program=${p.id}#apply`} className="mt-6 w-full">
            Apply for this program
          </ButtonLink>
        ) : (
          <p className="mt-6 rounded-[var(--radius)] bg-sand px-4 py-3 text-center text-sm text-ink-2">Applications open with the next intake.</p>
        )}
      </div>
    </article>
  );
}

function ProgramsSkeleton() {
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading programs">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-[36rem]" />
      ))}
    </div>
  );
}

function HowToApply() {
  const steps = [
    { icon: ClipboardList, title: "Send the form", body: "Choose a program and tell us about yourself. It takes about five minutes and costs nothing." },
    { icon: MessageCircle, title: "We get in touch", body: "Someone from the salon calls or messages you within a few days to talk about your goals." },
    { icon: BadgeCheck, title: "Confirm your place", body: "If it's a good fit, we agree dates, fees and what to bring, and save your place." },
  ];
  return (
    <section aria-labelledby="how-title" className="bg-bg py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="how-title" align="center" eyebrow="How to apply" title={<>Three steps to your <em>place</em></>} />
        <ol className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-[var(--radius)] border border-line bg-surface p-6 text-center">
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
        <p className="mt-10 text-center">
          <ButtonLink href="#apply" size="lg">
            Start your application <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        </p>
      </div>
    </section>
  );
}

/** Plain statement of the personal details asked for, and why (basic KYC, no documents). */
function WhatWeAsk() {
  const items = [
    { what: "Name, phone and email", why: "so we can reach you about your application" },
    { what: "Date of birth", why: "to confirm you're 16 or older" },
    { what: "Town and state", why: "to plan sessions and travel with you" },
    { what: "Your experience", why: "so we suggest the right program" },
  ];
  return (
    <div className="mt-8 rounded-[var(--radius)] border border-line bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <ShieldCheck aria-hidden className="size-4 text-accent-text" /> What we ask for, and why
      </h3>
      <ul className="mt-3 space-y-2 text-sm text-ink-2">
        {items.map((i) => (
          <li key={i.what}>
            <span className="font-medium text-ink">{i.what}</span>: {i.why}.
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-3">We don&apos;t ask for ID documents online. If you&apos;re offered a place, we may ask to see an ID in person.</p>
    </div>
  );
}

async function Apply({ searchParams }: Props) {
  const [{ program }, programs, nowMs] = await Promise.all([searchParams, listPublicPrograms(), requestNow()]);
  const open = programs.filter((p) => p.acceptingApplications).map((p) => ({ id: p.id, name: p.name, duration: p.duration, level: p.level }));
  return <ApplyForm programs={open} initialProgramId={program ?? null} maxBirthDate={latestBirthDate(lagosDateKey(nowMs))} />;
}

const FAQ = [
  { q: "Does it cost anything to apply?", a: "No. Applying is free. Each program shows its fee, or we explain it when we contact you. You don't pay anything until your place is agreed." },
  { q: "Do I need experience?", a: "Not for the beginner program. Some programs suit people who already do hair; each one says who it's for." },
  { q: "How soon will I hear back?", a: "Usually within a few days. We'll call, WhatsApp or email you using the details on your form." },
  { q: "Can I apply for more than one program?", a: "Yes. Send one application for each program. We'll help you choose the best starting point when we talk." },
  { q: "Do I need to bring anything?", a: "We'll tell you exactly what to bring once your place is confirmed." },
];

function Faq() {
  return (
    <section aria-labelledby="faq-title" className="bg-bg py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading id="faq-title" align="center" eyebrow="Questions" title={<>Good to <em>know</em></>} />
        <div className="mt-10 divide-y divide-line rounded-[var(--radius)] border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="text-xl leading-none text-accent-text transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 text-sm text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-ink-2">
          Want your own locs done instead?{" "}
          <Link href="/book" className="link-caps">
            Book an appointment <ArrowRight aria-hidden className="size-4" />
          </Link>
        </p>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section aria-labelledby="lm-cta-title" className="on-night bg-night text-on-night">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center sm:px-6 md:py-20">
        <HandHeart aria-hidden className="size-8 text-lilac" />
        <h2 id="lm-cta-title" className="mt-4 font-display text-[2.2rem] font-light leading-tight sm:text-5xl">
          Ready to turn your love of locs into <em className="text-lilac">a skill?</em>
        </h2>
        <p className="mt-4 text-on-night-2">Free to apply. We&apos;ll talk it through before you commit.</p>
        <ButtonLink href="#apply" variant="light" size="lg" className="mt-8">
          Apply now <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
    </section>
  );
}
