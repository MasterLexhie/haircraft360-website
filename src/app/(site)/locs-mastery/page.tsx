import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BookOpen, CalendarClock, Check, ClipboardList, GraduationCap, Ruler, Scissors, ShieldCheck, Sparkles, Store, Wallet, Wrench } from "lucide-react";
import { latestBirthDate } from "@/domain/academy";
import { formatNaira } from "@/lib/money";
import { lagosDateKey } from "@/lib/time";
import { listPublicPrograms, type ProgramRow } from "@/server/academy";
import { requestNow } from "@/server/queries";
import { StockPhoto, Sticker, Wave } from "@/components/site/brand";
import { IconTile, Kicker, PageIntro, Strip, Title, wrap } from "@/components/site/groove";
import { pill } from "@/components/site/pill";
import { MobileBarReveal } from "@/components/site/mobile-bar-reveal";
import { ACADEMY_PHOTOS } from "@/config/stock-photos";
import { Badge, ButtonLink, SectionHeading, Skeleton, cx } from "@/components/ui/primitives";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Locs Mastery programs",
  description: "Hands-on loc training, from starting locs to styling and running a loc business. Free to apply online.",
};

type Props = { searchParams: Promise<{ program?: string }> };

export default function LocsMasteryPage({ searchParams }: Props) {
  return (
    <>
      <Hero />
      <Band />
      <Learn />
      <section id="programs" aria-labelledby="programs-title" className="scroll-mt-24 bg-sand py-16 sm:py-24">
        <div className={wrap}>
          <div className="reveal">
          <SectionHeading id="programs-title" eyebrow="The programs" title={<>Find the program that <em>fits</em> you</>}>
            Each program is taught hands on. Dates and what to bring are talked through with you after you apply.
          </SectionHeading>
          </div>
          <Suspense fallback={<ProgramsSkeleton />}>
            <Programs />
          </Suspense>
        </div>
      </section>
      <HowToApply />
      <section id="apply" aria-labelledby="apply-title" className="scroll-mt-20 bg-sand py-16 sm:py-24">
        <div className={cx(wrap, "grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start")}>
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
      <ApplyBar />
    </>
  );
}

function Hero() {
  return (
    <PageIntro
      entrance
      kicker={<span className="inline-flex items-center gap-2"><GraduationCap aria-hidden className="size-5" /> Locs Mastery</span>}
      title={<>Learn the craft of <em>locs,</em> hands on.</>}
      lead={
        <>
          Whether you&apos;ve never started a loc or you already have clients in your chair, our programs teach the skills that keep clients coming back:
          clean parts, neat retwists, healthy scalps and styles people ask about.
        </>
      }
      aside={
        <div className="relative pl-6 md:pl-10">
          <StockPhoto
            photo={ACADEMY_PHOTOS.hero}
            label="replace with the tutor teaching"
            ratio="4/3"
            sizes="(min-width: 768px) 45vw, 90vw"
            priority
            className="rounded-[28px] border-4 border-orange md:border-[6px]"
          />
          <Sticker id="lm-sticker" ring="LEARN · PRACTISE · GROW · " center="360" className="pop-in absolute -top-6 left-0 size-[88px] -rotate-[14deg] [--rise-delay:450ms] md:size-[120px]" />
        </div>
      }
    >
      <div id="lm-hero-actions" className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="#apply" className={pill("pink", "lg", "group")}>
          Apply now <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="#programs" className={pill("ghost-dark")}>
          See the programs
        </Link>
      </div>
    </PageIntro>
  );
}

function Band() {
  return <Strip label="About the programs" items={["Learn by doing", "Beginner to working stylist", "Free to apply", "Learn by doing", "Beginner to working stylist", "Free to apply"]} />;
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
    <section aria-labelledby="learn-title" className="py-14 sm:py-24">
      <div className={wrap}>
        <div className="reveal flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Kicker>What you could learn</Kicker>
            <Title id="learn-title">
              Skills that keep <em>clients</em> coming back
            </Title>
          </div>
          <p className="max-w-[400px] text-ink-2">Every program covers some of these. Each one below lists exactly what it teaches.</p>
        </div>
        <ul className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {SKILLS.map((sk, i) => (
            <li key={sk.title} className="reveal">
              <IconTile icon={sk.icon} title={sk.title} tone={i % 2 ? "lilac" : "orange"}>
                {sk.body}
              </IconTile>
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
        <li key={p.id} className="reveal">
          <ProgramCard program={p} photoIndex={i} />
        </li>
      ))}
    </ul>
  );
}

function ProgramCard({ program: p, photoIndex }: { program: ProgramRow; photoIndex: number }) {
  const photo = ACADEMY_PHOTOS.programs[photoIndex % ACADEMY_PHOTOS.programs.length]!;
  return (
    <article
      aria-labelledby={`prog-${p.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius)] bg-surface shadow-[var(--shadow-sm)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)] motion-reduce:hover:translate-y-0"
    >
      <div className="overflow-hidden">
        <StockPhoto photo={photo} ratio="16/9" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" className="rounded-none transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
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
    { title: "Send the form", body: "Choose a program and tell us about yourself. It takes about five minutes and costs nothing." },
    { title: "We get in touch", body: "Someone from the salon calls or messages you within a few days to talk about your goals." },
    { title: "Confirm your place", body: "If it's a good fit, we agree dates, fees and what to bring, and save your place." },
  ];
  return (
    <section aria-labelledby="how-title" className="relative overflow-hidden py-14 sm:py-24">
      <div aria-hidden className="absolute -right-36 top-10 size-[420px] rounded-[48%_52%_60%_40%/50%_40%_60%_50%] bg-lilac/30" />
      <div className={cx(wrap, "relative grid items-center gap-10 md:grid-cols-2 md:gap-20")}>
        <div className="reveal">
          <Kicker>How to apply</Kicker>
          <Title id="how-title">
            Three steps to your <em>place</em>
          </Title>
          <p className="mt-5 max-w-[460px] text-ink-2 sm:text-lg">No commitment until you&apos;ve spoken to us, and nothing to pay to apply.</p>
          <Link href="#apply" className={pill("plum", "lg", "group mt-8")}>
            Start your application <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <ol className="relative grid gap-5">
          <span aria-hidden className="step-line absolute bottom-10 left-[2.05rem] top-10 w-[3px] rounded-full bg-clay/60 sm:left-[2.3rem]" />
          {steps.map((st, i) => (
            <li key={st.title} style={{ "--step": i } as React.CSSProperties} className="reveal-step relative flex gap-5 rounded-[20px] border border-line bg-surface p-5 shadow-[0_18px_36px_-28px_rgb(46_29_45/0.4)] sm:p-6">
              <span aria-hidden className="w-8 shrink-0 font-groove text-[1.8rem] leading-none text-clay">{i + 1}</span>
              <span>
                <span className="sr-only">Step {i + 1}: </span>
                <span className="block font-serif text-xl font-semibold">{st.title}</span>
                <span className="mt-1 block text-[0.94rem] text-ink-2">{st.body}</span>
              </span>
            </li>
          ))}
        </ol>
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
        <div className="reveal">
          <SectionHeading id="faq-title" align="center" eyebrow="Questions" title={<>Good to <em>know</em></>} />
        </div>
        <div className="reveal mt-10 divide-y divide-line rounded-[var(--radius)] border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="smooth-details group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="text-xl leading-none text-accent-text transition-transform duration-300 group-open:rotate-45">+</span>
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

/**
 * Phone only: "Apply now" slides up once the hero's buttons scroll away, and slides back down while
 * the application form itself is on screen, so there is always one way to apply and never two.
 */
function ApplyBar() {
  return (
    <MobileBarReveal watch="lm-hero-actions" hideWhileVisible="apply" className="fixed inset-x-0 bottom-0 z-30 md:hidden">
      <div
        className="flex gap-2.5 border-t border-cream-line bg-surface/95 px-4 pt-2.5 shadow-[0_-10px_24px_-16px_rgb(46_29_45/0.45)] backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <Link href="#programs" className={pill("ghost", "lg", "flex-1 px-3")}>
          Programs
        </Link>
        <Link href="#apply" className={pill("pink", "lg", "flex-[1.4] px-3")}>
          Apply free <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </MobileBarReveal>
  );
}

function Closing() {
  return (
    <>
      <Wave from="bg-bg" to="text-dusk" />
      <section aria-labelledby="lm-cta-title" className="on-night bg-dusk pb-14 pt-8 text-on-night sm:pb-22 sm:pt-14">
        <div className={cx(wrap, "flex flex-col justify-between gap-8 md:flex-row md:items-center")}>
          <div>
            <h2 id="lm-cta-title" className="max-w-[720px] font-serif text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[3.25rem]">
              Ready to turn your love of locs into <em className="font-normal text-orange">a skill?</em>
            </h2>
            <p className="mt-4 text-on-night-2">Free to apply. We&apos;ll talk it through before you commit.</p>
          </div>
          <Link href="#apply" className={pill("pink", "lg", "group self-start md:self-auto")}>
            Apply now <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </>
  );
}
