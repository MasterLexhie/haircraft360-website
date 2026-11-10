import type { Metadata } from "next";
import { ArrowRight, Plus } from "lucide-react";
import { LogoLockup, PhotoPlaceholder } from "@/components/site/brand";
import { Alert, Badge, Button, DemoTag, Field, SectionHeading, inputClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Design system" };

const SWATCHES = [
  { name: "bg", hex: "#FDFAFC", cls: "bg-bg" },
  { name: "surface", hex: "#FFFFFF", cls: "bg-surface" },
  { name: "sand", hex: "#F5EFF1", cls: "bg-sand" },
  { name: "sand-2", hex: "#EBE1E5", cls: "bg-sand-2" },
  { name: "line-strong", hex: "#D3BCC5", cls: "bg-line-strong" },
  { name: "accent (plum)", hex: "#513650", cls: "bg-accent", dark: true },
  { name: "night", hex: "#3E283D", cls: "bg-night", dark: true },
  { name: "lilac (logo)", hex: "#F8BCF8", cls: "bg-lilac" },
  { name: "ink", hex: "#2B2029", cls: "bg-ink", dark: true },
  { name: "ink-3", hex: "#6F5F6C", cls: "bg-ink-3", dark: true },
];

/** Living reference for DESIGN-SYSTEM.md. Not linked from the public navigation. */
export default function StyleguidePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="type-caps text-[0.72rem] text-ink-3">Haircraft360 · prototype</p>
        <h1 className="type-display mt-3 text-[2.6rem] sm:text-6xl">
          The <em>Plum Lounge</em> design system
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Tokens and components used across the site and admin. Full rules live in <code className="text-sm">DESIGN-SYSTEM.md</code>.
        </p>
      </header>

      <section aria-labelledby="sg-colour" className="space-y-6">
        <SectionHeading id="sg-colour" variant="caps" title="Colour" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SWATCHES.map((s) => (
            <li key={s.name} className="overflow-hidden rounded-[var(--radius)] bg-surface shadow-[var(--shadow-sm)] ring-1 ring-line">
              <div className={`h-20 ${s.cls}`} />
              <p className="px-3 pt-2 text-xs font-semibold text-ink">{s.name}</p>
              <p className="px-3 pb-2 font-mono text-xs text-ink-3">{s.hex}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sg-type" className="space-y-6">
        <SectionHeading id="sg-type" variant="caps" title="Typography" />
        <div className="space-y-6 rounded-[var(--radius)] bg-surface p-6 shadow-[var(--shadow-sm)] sm:p-10">
          <p className="type-display text-5xl">Display · Loc care, <em>beautifully</em> done</p>
          <p className="type-caps text-2xl tracking-[0.18em] text-accent-text">Caps headline</p>
          <p className="type-caps text-[0.8rem] text-accent-text">Caps label · card title strip</p>
          <p className="max-w-xl text-ink-2">
            Body · Montserrat 16px at 1.6 line height. Pick your services, choose a time that suits you, and reserve your chair online.
          </p>
          <a href="#sg-type" className="link-caps">Caps link <ArrowRight aria-hidden className="size-4" /></a>
          <div className="flex items-center gap-6 border-t border-line pt-6">
            <LogoLockup />
            <span className="rounded-[var(--radius)] bg-accent p-3"><LogoLockup tone="dark" /></span>
          </div>
        </div>
      </section>

      <section aria-labelledby="sg-buttons" className="space-y-6">
        <SectionHeading id="sg-buttons" variant="caps" title="Buttons" />
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="night">Night</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="on-night flex flex-wrap items-center gap-3 rounded-[var(--radius)] bg-accent p-6">
          <Button variant="light">Light on plum</Button>
          <span className="font-display text-xl italic text-lilac">Lilac accent on plum</span>
        </div>
      </section>

      <section aria-labelledby="sg-cards" className="space-y-6">
        <SectionHeading id="sg-cards" variant="caps" title="Cards & panels" />
        <div className="grid gap-6 md:grid-cols-3">
          <article className="bg-surface shadow-[var(--shadow-sm)]">
            <h3 className="type-caps bg-sand-2 px-5 py-4 text-center text-[0.85rem] text-accent-text">Service card</h3>
            <PhotoPlaceholder label="service photo" ratio="16/9" className="rounded-none" />
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg italic text-accent-text">01</span>
                <DemoTag>Demo service</DemoTag>
              </div>
              <p className="text-ink-2">Card body copy in Montserrat.</p>
              <Button variant="secondary" className="w-full"><Plus aria-hidden className="size-4" /> Add to booking</Button>
            </div>
          </article>
          <div className="bg-sand-2 p-6">
            <h3 className="type-caps text-[0.85rem] text-accent-text">Blush panel</h3>
            <p className="mt-3 text-sm text-ink-2">Contact details, notes and grouped information.</p>
          </div>
          <div className="on-night bg-night p-6 text-on-night">
            <h3 className="type-caps text-[0.85rem] text-lilac">Night panel</h3>
            <p className="mt-3 font-display text-2xl font-light">Ready for your next <em className="text-lilac">appointment?</em></p>
          </div>
        </div>
      </section>

      <section aria-labelledby="sg-forms" className="space-y-6">
        <SectionHeading id="sg-forms" variant="caps" title="Forms, badges & alerts" />
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4 rounded-[var(--radius)] bg-surface p-6 shadow-[var(--shadow-sm)]">
            <Field id="sg-name" label="Full name" required hint="As you'd like the salon to address you.">
              <input id="sg-name" className={inputClass} placeholder="e.g. Adaeze Okafor" />
            </Field>
            <Field id="sg-phone" label="Phone" error="Enter a Nigerian mobile number, e.g. 0803 123 4567.">
              <input id="sg-phone" aria-invalid className={inputClass} defaultValue="123" />
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked className="size-4" /> Checkbox in plum</label>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">Confirmed</Badge>
              <Badge tone="warning">Awaiting deposit</Badge>
              <Badge tone="danger">Balance due</Badge>
              <Badge tone="info">Deposit paid</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge>Neutral</Badge>
            </div>
            <Alert tone="info" title="Info alert">Supporting detail goes here.</Alert>
            <Alert tone="success" title="Success alert" />
            <Alert tone="danger" title="Error alert">Explain the cause and how to fix it.</Alert>
          </div>
        </div>
      </section>
    </div>
  );
}
