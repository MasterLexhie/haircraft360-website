import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Camera, Check, Clock, GraduationCap, MapPin, MessageCircle, Navigation, Phone, Scissors, ShieldCheck, Sparkles } from "lucide-react";
import { getActiveServices, getPublicSettings, getSalon } from "@/server/queries";
import { hoursSummary } from "@/domain/salon";
import type { Service } from "@/domain/types";
import type { WeekdayKey } from "@/domain/settings";
import { describeDepositRule } from "@/components/booking/booking-summary";
import { Sticker, Wave } from "@/components/site/brand";
import { pill } from "@/components/site/pill";
import { Kicker, Strip, Title, wrap } from "@/components/site/groove";
import { ServicePhoto } from "@/components/site/service-photo";
import { VisitCard } from "@/components/site/visit-card";
import { BeforeAfter } from "@/components/site/before-after";
import { MobileBarReveal } from "@/components/site/mobile-bar-reveal";
import { HERO_PHOTO, GALLERY_PAIRS, SERVICE_PHOTOS, type StockPhoto } from "@/config/stock-photos";
import { Skeleton, cx } from "@/components/ui/primitives";
import { formatNaira } from "@/lib/money";
import { formatDuration, formatHHMM, WEEKDAYS } from "@/lib/time";

/*
 * Home page, Studio Groove (canvas variation D): Warm Studio's calm layout with Groove's colours,
 * accent face and a few playful moments. Services, prices, hours, deposit and contact details all
 * come from Settings and the service list, never from this file.
 */


export default function HomePage() {
  return (
    <div className="bg-cream text-ink">
      <Hero />
      <CraftStrip />
      <WhyUs />
      <OurWork />
      <BeforeAndAfter />
      <Wave from="bg-cream" to="text-dusk" />
      <section id="services" aria-labelledby="services-title" className="on-night scroll-mt-20 bg-dusk pb-16 pt-10 text-on-night sm:pb-24 sm:pt-16">
        <div className={wrap}>
          <Suspense fallback={<Skeleton className="h-[36rem] bg-on-night/10" />}>
            <Services />
          </Suspense>
        </div>
      </section>
      <Suspense fallback={null}>
        <MakeADayOfIt />
      </Suspense>
      <GoodToKnow />
      <Visit />
      <Mastery />
      <Wave from="bg-surface" to="text-dusk" />
      <ClosingCta />
      <Suspense fallback={null}>
        <MobileBar />
      </Suspense>
    </div>
  );
}

/* ───────────── small pieces ───────────── */

/** A WhatsApp chat with the salon, optionally with a first message typed in for the customer. */
function whatsappHref(e164: string, text?: string) {
  return `https://wa.me/${e164.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Stock photo with a small honest label, so it is never taken for the salon's own work. */
function Photo({ photo, sizes, priority, className, imgClassName, labelClassName = "right-2 top-2" }: { photo: StockPhoto; sizes: string; priority?: boolean; className?: string; imgClassName?: string; labelClassName?: string }) {
  return (
    <div className={cx("relative overflow-hidden", className)}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className={cx("object-cover", imgClassName)} />
      <span className={cx("absolute rounded-md bg-surface/85 px-1.5 py-0.5 text-[0.62rem] font-semibold text-ink-2", labelClassName)}>Stock photo</span>
    </div>
  );
}

/* ───────────── hero ───────────── */

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="on-night relative overflow-hidden bg-dusk text-on-night">
      <div aria-hidden className="absolute -right-28 top-4 size-[300px] rounded-full bg-accent md:-right-36 md:-top-24 md:size-[640px]" />
      <div className={cx(wrap, "relative grid items-center gap-8 pb-10 pt-2 md:grid-cols-[1.05fr_1fr] md:gap-14 md:pb-20 md:pt-12")}>
        <div className="order-2 md:order-1">
          <p className="rise inline-flex items-center gap-2.5 rounded-full bg-lilac/15 px-4 py-2 text-sm font-semibold text-lilac">
            <Sparkles aria-hidden className="size-4" /> Locs and nails, under one roof
          </p>
          <h1 id="hero-title" className="mt-5 font-serif text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[3.6rem] lg:text-[4.75rem]">
            Healthy locs and neat nails, done with <em className="font-normal text-orange">care.</em>
          </h1>
          <p className="rise mt-5 max-w-[500px] text-base text-on-night-2 [--rise-delay:120ms] sm:text-lg">
            From your first starter locs to a fresh pedicure, every client gets our full, unhurried attention and work you will be proud to show off.
          </p>
          <div id="hero-actions" className="rise mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 [--rise-delay:220ms]">
            <Link href="#services" className={pill("pink")}>
              See our services <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="/book" className="inline-flex min-h-11 items-center font-semibold text-on-night underline underline-offset-[6px] hover:text-lilac">
              Book a visit
            </Link>
          </div>
          <Suspense fallback={<div className="mt-10 h-14" />}>
            <HeroFacts />
          </Suspense>
        </div>

        <div className="relative order-1 pl-6 md:order-2 md:pl-10">
          <div className="arch-in">
          <Photo
            photo={HERO_PHOTO}
            sizes="(min-width: 768px) 45vw, 90vw"
            priority
            className="h-[300px] rounded-[160px_160px_18px_18px] border-4 border-orange sm:h-[420px] md:h-[580px] md:rounded-[280px_280px_24px_24px] md:border-[6px]"
            imgClassName="object-[center_20%]"
            labelClassName="bottom-3 left-3 md:bottom-4 md:left-auto md:right-4"
          />
          </div>
          <Sticker id="hero-sticker" ring="LOCS · NAILS · LOCS · NAILS · " center="360" className="pop-in absolute left-0 top-3 size-[88px] -rotate-[14deg] [--rise-delay:450ms] md:top-8 md:size-[132px]" />
          <div className="rise absolute bottom-3 right-3 flex items-center gap-3 rounded-2xl bg-cream [--rise-delay:380ms] py-2 pl-2 pr-4 text-ink shadow-[0_24px_48px_-24px_rgb(0_0_0/0.6)] md:bottom-10 md:left-0 md:right-auto md:py-3 md:pl-3">
            <span className="grid size-10 place-items-center rounded-xl bg-orange md:size-12">
              <Scissors aria-hidden className="size-5" />
            </span>
            <span className="text-[0.8rem] leading-snug md:text-sm">
              <span className="block font-bold">Done by hand</span>
              <span className="text-ink-3">Never rushed</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

async function HeroFacts() {
  const [salon, { availability }] = await Promise.all([getSalon(), getPublicSettings()]);
  const hours = hoursSummary(availability.weeklyHours, formatHHMM);
  return (
    <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-on-night/15 pt-6 text-sm text-on-night-2">
      {hours.open[0] && (
        <li className="flex items-center gap-2">
          <Clock aria-hidden className="size-4 shrink-0" /> {hours.open.join(" · ")}
        </li>
      )}
      {salon.addressLines[0] && (
        <li className="flex items-center gap-2">
          <MapPin aria-hidden className="size-4 shrink-0" /> {salon.addressLines.slice(0, 2).join(", ")}
        </li>
      )}
    </ul>
  );
}

/* ───────────── the orange strip of crafts ───────────── */

const CRAFTS = ["Starter locs", "Retwists", "Crochet maintenance", "Repairs", "Reinstallation", "Manicure", "Pedicure", "Nail fixing"];

function CraftStrip() {
  return <Strip items={CRAFTS} label="What we do" />;
}

/* ───────────── why us ───────────── */

const PROMISES = [
  { icon: Scissors, title: "Locs and nails", body: "Loc care and nail care, both done by hand, under one roof.", tone: "bg-orange" },
  { icon: Clock, title: "Patience over speed", body: "We take the time your hair needs, so your locs stay strong.", tone: "bg-lilac" },
  { icon: Check, title: "Honest advice", body: "If your locs need a repair, not a retwist, we will tell you.", tone: "bg-orange" },
  { icon: MessageCircle, title: "Ask us anything", body: "Send a photo and we will tell you what your locs need.", tone: "bg-lilac" },
];

function WhyUs() {
  return (
    <section aria-labelledby="why-title" className="pb-4 pt-14 sm:pt-24">
      <div className={wrap}>
        <div className="reveal flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Kicker>Why Haircraft360</Kicker>
            <Title id="why-title">
              Two crafts, <em>one</em> salon.
            </Title>
          </div>
          <p className="max-w-[400px] text-ink-2">Careful hands for your hair, your hands and your feet.</p>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <li key={p.title} className="reveal rounded-[20px] border border-cream-line bg-surface p-4 shadow-[0_18px_36px_-28px_rgb(46_29_45/0.4)] sm:p-6">
              <span className={cx("grid size-10 place-items-center rounded-full text-ink sm:size-13", p.tone)}>
                <p.icon aria-hidden className="size-[18px] sm:size-[22px]" />
              </span>
              <h3 className="mt-3 font-serif text-lg font-semibold leading-tight sm:mt-4 sm:text-2xl">{p.title}</h3>
              <p className="mt-2 hidden text-[0.94rem] text-ink-2 sm:block">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────────── our work ───────────── */

const WORK: { photo: StockPhoto; caption: string }[] = [
  { photo: GALLERY_PAIRS[0]!.after, caption: "Starter locs, a few months in" },
  { photo: GALLERY_PAIRS[1]!.after, caption: "Retwist" },
  { photo: GALLERY_PAIRS[2]!.after, caption: "Long locs" },
  { photo: SERVICE_PHOTOS.seed_svc_retwist!, caption: "Neat roots" },
];

function Caption({ children, big }: { children: React.ReactNode; big?: boolean }) {
  return (
    <span className={cx("absolute rounded-full bg-cream font-groove leading-tight text-ink", big ? "bottom-4 left-4 px-4 py-2 text-base" : "bottom-3 left-3 px-3 py-1.5 text-sm")}>
      {children}
    </span>
  );
}

function OurWork() {
  const [first, ...rest] = WORK;
  return (
    <section id="work" aria-labelledby="work-title" className="scroll-mt-20 py-14 sm:py-24">
      <div className={wrap}>
        <div className="reveal flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <Kicker>Our work</Kicker>
            <Title id="work-title">
              Fresh from the <em>chair</em>
            </Title>
          </div>
          <Suspense fallback={null}>
            <InstagramLink />
          </Suspense>
        </div>
        <ul className="reveal mt-8 flex snap-x gap-3 overflow-x-auto pb-2 md:mt-10 md:grid md:grid-cols-4 md:grid-rows-[300px_300px] md:gap-4 md:overflow-visible md:pb-0">
          <li className="relative w-[78%] shrink-0 snap-start md:col-span-2 md:row-span-2 md:w-auto">
            <Photo photo={first!.photo} sizes="(min-width: 768px) 50vw, 80vw" className="aspect-[4/5] rounded-[20px] md:aspect-auto md:h-full" />
            <Caption big>{first!.caption}</Caption>
          </li>
          {rest.slice(0, 2).map((w) => (
            <li key={w.caption} className="relative w-[78%] shrink-0 snap-start md:w-auto">
              <Photo photo={w.photo} sizes="(min-width: 768px) 25vw, 80vw" className="aspect-[4/5] rounded-[20px] md:aspect-auto md:h-full" />
              <Caption>{w.caption}</Caption>
            </li>
          ))}
          <li className="grid w-[78%] shrink-0 snap-start place-items-center rounded-[20px] bg-lilac p-6 text-center md:w-auto">
            <span className="text-sm font-semibold">
              Nail photos coming soon
              <span className="mt-1 block font-normal text-ink-2">Manicures, pedicures and nail fixing</span>
            </span>
          </li>
          {rest.slice(2).map((w) => (
            <li key={w.caption} className="relative w-[78%] shrink-0 snap-start md:w-auto">
              <Photo photo={w.photo} sizes="(min-width: 768px) 25vw, 80vw" className="aspect-[4/5] rounded-[20px] md:aspect-auto md:h-full" />
              <Caption>{w.caption}</Caption>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

async function InstagramLink() {
  const salon = await getSalon();
  const ig = salon.social.find((s) => s.platform === "instagram");
  if (!ig) return null;
  return (
    <a href={ig.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 font-bold text-accent-text underline-offset-4 hover:underline">
      <Camera aria-hidden className="size-[18px]" /> More on Instagram
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/* ───────────── before and after ───────────── */

/**
 * Before and after of real clients, one slider per pair. Shows only once the owner has added a
 * pair of the same client (`sameClient: true` in config/stock-photos.ts); until then the page
 * goes straight from Our work to the services.
 */
function BeforeAndAfter() {
  const pairs = GALLERY_PAIRS.filter((p) => p.sameClient);
  if (pairs.length === 0) return null;
  return (
    <section aria-labelledby="results-title" className="pb-14 sm:pb-24">
      <div className={wrap}>
        <div className="reveal flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <Kicker>Before and after</Kicker>
            <Title id="results-title">
              See the <em>difference</em>
            </Title>
          </div>
          <p className="max-w-[400px] text-ink-2">Real clients, before and after their visit. Drag across a photo to compare.</p>
        </div>
        <ul className={cx("mt-8 grid gap-6 sm:mt-10", pairs.length === 1 ? "max-w-xl" : pairs.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3")}>
          {pairs.map((p) => (
            <li key={p.label} className="reveal">
              <figure>
                <BeforeAfter before={p.before} after={p.after} label={p.label} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" className="aspect-[4/5] rounded-[20px]" />
                <figcaption className="mt-3 font-serif text-xl font-semibold">{p.label}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────────── services ───────────── */

async function Services() {
  const [services, salon] = await Promise.all([getActiveServices(), getSalon()]);
  const main = services.filter((s) => s.bookableAlone);
  const half = Math.ceil(main.length / 2);
  // Once any service has a photo, every row keeps a photo spot so the list stays lined up.
  const withPhotos = main.some((s) => s.photo);
  return (
    <>
      <div className="reveal flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Kicker tone="orange">What we do</Kicker>
          <Title id="services-title">
            Locs and <em className="text-lilac">nails</em>
          </Title>
        </div>
        <p className="max-w-[420px] text-[0.95rem] text-on-night-2">
          Everything is done by hand, at a pace that keeps your hair and nails healthy. We confirm the price with you before we start.
        </p>
      </div>

      {main.length === 0 ? (
        <p className="mt-10 rounded-[18px] border border-on-night/15 p-8 text-center text-on-night-2">Our service list is being updated. Please check back soon.</p>
      ) : (
        <div className="mt-8 grid gap-x-18 md:mt-10 md:grid-cols-2">
          {[main.slice(0, half), main.slice(half)].map((col, i) => (
            <ul key={i} className={cx(i === 1 && "border-t border-on-night/15 md:border-t-0")}>
              {col.map((s) => (
                <ServiceRow key={s.id} s={s} withPhoto={withPhotos} />
              ))}
            </ul>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col justify-between gap-4 rounded-[18px] border border-on-night/15 bg-on-night/[0.06] p-5 md:flex-row md:items-center md:px-7">
        <p>
          <strong>Not sure what your locs need?</strong>{" "}
          <span className="text-on-night-2">
            {salon.whatsapp ? "Send us a photo on WhatsApp and we will tell you honestly." : "Ask us and we will tell you honestly."}
          </span>
        </p>
        <div className="flex flex-wrap gap-3">
          {salon.whatsapp ? (
            <a
              href={whatsappHref(salon.whatsapp.e164, "Hi Haircraft360, I'd like to ask about my locs or nails.")}
              target="_blank"
              rel="noopener noreferrer"
              className={pill("pink", "md")}
            >
              <MessageCircle aria-hidden className="size-4" /> Ask on WhatsApp
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : salon.phone ? (
            <a href={`tel:${salon.phone.e164}`} className={pill("pink", "md")}>
              <Phone aria-hidden className="size-4" /> Call to ask
            </a>
          ) : null}
          <Link href="/book" className={pill("ghost-dark", "md")}>
            Book a visit
          </Link>
        </div>
      </div>
    </>
  );
}

function ServiceRow({ s, withPhoto }: { s: Service; withPhoto: boolean }) {
  return (
    <li className="border-t border-on-night/15 first:border-t-0 md:first:border-t">
      <Link
        href={`/book?service=${s.id}`}
        className={cx(
          "group -mx-3 grid gap-x-4 gap-y-1 rounded-2xl px-3 py-4 text-on-night transition-[background-color,transform] duration-200 hover:bg-on-night/[0.05] active:scale-[0.99] active:bg-on-night/[0.08] sm:py-5",
          withPhoto ? "grid-cols-[4rem_minmax(0,1fr)_auto] sm:grid-cols-[5rem_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]",
        )}
      >
        {withPhoto && (
          <span className="row-span-2 size-16 self-start overflow-hidden rounded-2xl bg-accent sm:size-20">
            {s.photo ? (
              <ServicePhoto photo={s.photo} name={s.name} decorative className="size-full transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <span aria-hidden className="grid size-full place-items-center text-lilac">
                <Sparkles className="size-5" />
              </span>
            )}
          </span>
        )}
        <span className="text-base font-semibold group-hover:text-lilac sm:text-[1.06rem]">{s.name}</span>
        <span className="tabular font-serif text-xl font-semibold text-orange">{formatNaira(s.priceKobo)}</span>
        <span className="text-sm text-on-night-2">{s.description}</span>
        <span className="relative whitespace-nowrap text-right text-[0.8rem] text-on-night-2">
          <span className="block transition-[opacity,transform] duration-200 group-hover:-translate-y-1 group-hover:opacity-0 group-focus-visible:-translate-y-1 group-focus-visible:opacity-0">
            About {formatDuration(s.durationMinutes)}
          </span>
          <span aria-hidden className="absolute inset-0 flex translate-y-1 items-center justify-end gap-1 font-semibold text-lilac opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            Book <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </span>
      </Link>
    </li>
  );
}

/* ───────────── make a day of it ───────────── */

/** The main service that offers the most add-ons, with those add-ons, read from the service list. */
function pickPairing(services: Service[]) {
  const byId = new Map(services.map((s) => [s.id, s]));
  let best: { main: Service; addOns: Service[] } | null = null;
  for (const s of services) {
    if (!s.bookableAlone) continue;
    const addOns = s.addOnIds.map((id) => byId.get(id)).filter((a): a is Service => !!a);
    if (addOns.length > 0 && (!best || addOns.length > best.addOns.length)) best = { main: s, addOns };
  }
  return best;
}

async function MakeADayOfIt() {
  const pairing = pickPairing(await getActiveServices());
  const steps = ["Choose your loc service", "Add a manicure or a pedicure", "Sit back, we take our time"];
  return (
    <section aria-labelledby="day-title" className="relative overflow-hidden py-14 sm:py-24">
      <div aria-hidden className="absolute -right-36 top-16 size-[460px] rounded-[48%_52%_60%_40%/50%_40%_60%_50%] bg-lilac/30" />
      <div className={cx(wrap, "relative grid items-center gap-10 md:grid-cols-2 md:gap-20")}>
        <div className="reveal">
          <Kicker>Make a day of it</Kicker>
          <Title id="day-title">
            Come for your locs, leave with <em>fresh nails</em> too.
          </Title>
          <p className="mt-5 max-w-[480px] text-ink-2 sm:text-lg">
            Pair your loc service with a manicure or pedicure, done with the same patience we give your hair, and leave cared for from head to toe.
          </p>
          <ol className="mt-7 grid gap-3.5">
            {steps.map((t, i) => (
              <li key={t} className="flex items-center gap-3.5">
                <span aria-hidden className="w-7 font-groove text-[1.4rem] text-clay">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        {pairing && (
          <div className="reveal">
            <VisitCard main={pairing.main} addOns={pairing.addOns.slice(0, 3)} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────── good to know ───────────── */

function GoodToKnow() {
  return (
    <section aria-labelledby="know-title" className="bg-cream-2 py-14 sm:py-24">
      <div className={cx(wrap, "grid items-start gap-8 md:grid-cols-2 md:gap-18")}>
        <div className="reveal">
          <Kicker>Good to know</Kicker>
          <Title id="know-title">
            Your visit, without <em>surprises</em>
          </Title>
          <p className="mt-5 max-w-[480px] text-ink-2 sm:text-lg">
            We agree the service and the price before we start, and we tell you how to look after your locs or nails when we finish.
          </p>
        </div>
        <div className="reveal rounded-3xl border border-cream-line bg-surface p-6 sm:p-8">
          <Suspense fallback={<Skeleton className="h-48" />}>
            <VisitTerms />
          </Suspense>
          <p className="mt-6">
            <Link href="/terms" className="inline-flex min-h-11 items-center font-bold text-accent-text underline underline-offset-4">
              Read the booking terms
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

async function VisitTerms() {
  const settings = await getPublicSettings();
  return (
    <dl className="grid gap-4 text-[0.95rem]">
      <div>
        <dt className="flex items-center gap-2 font-bold">
          <ShieldCheck aria-hidden className="size-4 text-clay" /> Holding your time
        </dt>
        <dd className="mt-1 text-ink-2">A deposit holds your time: {describeDepositRule(settings.deposit)}. It comes off your bill, and you pay the rest at the salon.</dd>
      </div>
      <div>
        <dt className="font-bold">Need to change?</dt>
        <dd className="mt-1 text-ink-2">The deposit is not refundable. If you can&apos;t make it, contact the salon before your appointment and we will help you move to another time.</dd>
      </div>
    </dl>
  );
}

/* ───────────── visit ───────────── */

function Visit() {
  return (
    <section id="visit" aria-labelledby="visit-title" className="scroll-mt-20 border-t border-cream-line bg-surface py-14 sm:py-24">
      <div className={cx(wrap, "grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-14")}>
        <div className="reveal order-2 rounded-3xl bg-cream-2 p-6 sm:p-9 md:order-1">
          <h3 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <Clock aria-hidden className="size-5 text-clay" /> Opening hours
          </h3>
          <Suspense fallback={<Skeleton className="mt-6 h-56" />}>
            <HoursTable />
          </Suspense>
        </div>
        <div className="reveal order-1 md:order-2">
          <Kicker>Visit</Kicker>
          <Title id="visit-title">
            Find the <em>salon</em>
          </Title>
          <Suspense fallback={<Skeleton className="mt-7 h-48" />}>
            <VisitDetails />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function VisitDetails() {
  const [salon, { availability }] = await Promise.all([getSalon(), getPublicSettings()]);
  const hours = hoursSummary(availability.weeklyHours, formatHHMM);
  const ig = salon.social.find((s) => s.platform === "instagram");
  const item = "flex gap-3.5";
  const icon = "mt-0.5 size-5 shrink-0 text-clay";
  return (
    <>
      <ul className="mt-7 grid gap-5">
        {salon.address && (
          <li className={item}>
            <MapPin aria-hidden className={icon} />
            <span>
              <strong>{salon.addressLines[0]}</strong>
              {salon.addressLines.length > 1 && <span className="block text-ink-3">{salon.addressLines.slice(1).join(", ")}</span>}
            </span>
          </li>
        )}
        <li className={item}>
          <Clock aria-hidden className={icon} />
          <span>
            <strong>{hours.open.join(" · ") || "See opening hours"}</strong>
            <span className="block text-ink-3">{hours.closed}</span>
          </span>
        </li>
        {salon.whatsapp && (
          <li className={item}>
            <MessageCircle aria-hidden className={icon} />
            <span>
              <strong>WhatsApp {salon.whatsapp.display}</strong>
              <span className="block text-ink-3">Quickest way to reach us</span>
            </span>
          </li>
        )}
        {ig && (
          <li className={item}>
            <Camera aria-hidden className={icon} />
            <span>
              <a href={ig.href} target="_blank" rel="noopener noreferrer" className="font-bold underline-offset-4 hover:underline">
                Instagram
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <span className="block text-ink-3">New work most weeks</span>
            </span>
          </li>
        )}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={salon.mapsUrl} target="_blank" rel="noopener noreferrer" className={pill("ghost", "md")}>
          <Navigation aria-hidden className="size-4" /> Get directions
          <span className="sr-only"> on Google Maps (opens in a new tab)</span>
        </a>
        {salon.whatsapp && (
          <a href={whatsappHref(salon.whatsapp.e164)} target="_blank" rel="noopener noreferrer" className={pill("ghost", "md")}>
            <MessageCircle aria-hidden className="size-4" /> Chat on WhatsApp
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </>
  );
}

async function HoursTable() {
  const { availability } = await getPublicSettings();
  const order: WeekdayKey[] = ["1", "2", "3", "4", "5", "6", "0"];
  return (
    <table className="mt-5 w-full text-left text-[0.94rem]">
      <caption className="sr-only">Opening hours by day</caption>
      <tbody>
        {order.map((d) => {
          const h = availability.weeklyHours[d];
          return (
            <tr key={d} className="border-b border-cream-line last:border-0">
              <th scope="row" className="py-3 font-semibold">{WEEKDAYS[Number(d)]}</th>
              <td className={cx("py-3 text-right", h ? "tabular text-ink-2" : "font-serif italic text-ink-3")}>
                {h ? `${formatHHMM(h.open)} to ${formatHHMM(h.close)}` : "Closed"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ───────────── locs mastery, closing ───────────── */

function Mastery() {
  return (
    <section aria-labelledby="mastery-title" className="bg-surface pb-14 sm:pb-24">
      <div className={wrap}>
        <div className="reveal on-night relative grid items-center gap-6 overflow-hidden rounded-[28px] bg-accent p-7 text-on-night sm:p-12 md:grid-cols-[1.3fr_1fr] md:px-14">
          <div aria-hidden className="absolute -bottom-36 -right-20 size-[380px] rounded-full bg-lilac/20" />
          <div className="relative">
            <p className="flex items-center gap-2.5 font-groove text-base text-orange sm:text-lg">
              <GraduationCap aria-hidden className="size-5" /> Locs Mastery
            </p>
            <h2 id="mastery-title" className="mt-3 font-serif text-[2rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[2.75rem]">
              Love locs? <em className="font-normal text-lilac">Learn the craft.</em>
            </h2>
            <p className="mt-4 max-w-[520px] text-on-night-2 sm:text-lg">Hands-on programs in the salon, from your first starter to running a loc business.</p>
          </div>
          <div className="relative md:flex md:justify-end">
            <Link href="/locs-mastery" className={pill("pink")}>
              See the programs <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="on-night bg-dusk pb-14 pt-8 text-on-night sm:pb-22 sm:pt-14">
      <div className={cx(wrap, "flex flex-col justify-between gap-8 md:flex-row md:items-center")}>
        <h2 id="cta-title" className="max-w-[720px] font-serif text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[3.5rem]">
          Come and see what <em className="font-normal text-orange">careful hands</em> can do.
        </h2>
        <div className="hidden flex-col items-end gap-3 md:flex">
          <Link href="/book" className={pill("pink")}>
            Book a visit <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Phones: chat and book stay in reach. The footer leaves room for it. */
async function MobileBar() {
  const salon = await getSalon();
  return (
    <MobileBarReveal watch="hero-actions" className="fixed inset-x-0 bottom-0 z-30 md:hidden">
    <div
      className="flex gap-2.5 border-t border-cream-line bg-surface/95 px-4 pt-2.5 shadow-[0_-10px_24px_-16px_rgb(46_29_45/0.45)] backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {salon.whatsapp && (
        <a href={whatsappHref(salon.whatsapp.e164)} target="_blank" rel="noopener noreferrer" className={pill("pink", "lg", "flex-1 px-3")}>
          <MessageCircle aria-hidden className="size-[18px]" /> Chat with us
          <span className="sr-only"> on WhatsApp (opens in a new tab)</span>
        </a>
      )}
      <Link href="/book" className={pill(salon.whatsapp ? "ghost" : "pink", "lg", "flex-1 px-3")}>
        Book a visit
      </Link>
    </div>
    </MobileBarReveal>
  );
}
