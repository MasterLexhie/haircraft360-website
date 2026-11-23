import { Sparkles } from "lucide-react";
import { cx } from "@/components/ui/primitives";

/*
 * Studio Groove building blocks shared by the public pages, so every page reads like the home page:
 * a small label in the Groove face, a Fraunces heading with one italic word, and a page intro band.
 */

export const wrap = "mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-12";

/** Small label above a heading, in the Groove accent face. */
export function Kicker({ children, tone = "clay", className }: { children: React.ReactNode; tone?: "clay" | "orange" | "lilac"; className?: string }) {
  const color = tone === "clay" ? "text-clay" : tone === "orange" ? "text-orange" : "text-lilac";
  return <p className={cx("font-groove text-base leading-tight sm:text-lg", color, className)}>{children}</p>;
}

/** Section heading. Put the word to stress in <em>. */
export function Title({ id, children, className, as: Tag = "h2" }: { id?: string; children: React.ReactNode; className?: string; as?: "h1" | "h2" }) {
  return (
    <Tag id={id} className={cx("mt-2 font-serif text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[3.25rem] [&_em]:font-normal", className)}>
      {children}
    </Tag>
  );
}

/**
 * The top of an inner page: the dark band from the home page hero, with its plum circle,
 * a label, the page title and a short line. `children` sits under the text (buttons, facts).
 */
export function PageIntro({
  kicker,
  title,
  lead,
  children,
  aside,
  className,
  entrance = false,
}: {
  /** Plays the home page's short entrance: label, line, buttons and picture rise in; the title stays still. */
  entrance?: boolean;
  kicker: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("on-night relative overflow-hidden bg-dusk text-on-night", className)}>
      <div aria-hidden className="absolute -right-32 -top-24 size-[300px] rounded-full bg-accent sm:size-[460px]" />
      <div className={cx(wrap, "relative grid items-center gap-8 py-10 sm:py-16", aside ? "md:grid-cols-[1.1fr_1fr] md:gap-14" : null)}>
        <div>
          <Kicker tone="orange" className={entrance ? "rise" : undefined}>{kicker}</Kicker>
          <h1 className="mt-3 font-serif text-[2.4rem] font-semibold leading-[1.03] tracking-[-0.03em] sm:text-[3.5rem] lg:text-[4rem] [&_em]:font-normal [&_em]:text-orange">
            {title}
          </h1>
          {lead && <p className={cx("mt-4 max-w-[540px] text-base text-on-night-2 sm:text-lg", entrance && "rise [--rise-delay:120ms]")}>{lead}</p>}
          {entrance ? <div className="rise [--rise-delay:220ms]">{children}</div> : children}
        </div>
        {entrance && aside ? <div className="frame-in">{aside}</div> : aside}
      </div>
    </section>
  );
}

/**
 * The orange strip under a dark intro: a run of short phrases in the Groove face, drifting slowly
 * sideways (paused on hover, still when motion is reduced). The run is drawn twice so the loop is
 * seamless; screen readers get the first copy only.
 */
export function Strip({ items, label }: { items: string[]; label: string }) {
  const run = (hidden: boolean) => (
    <ul aria-label={hidden ? undefined : label} aria-hidden={hidden || undefined} className="flex shrink-0 gap-6 pr-6 sm:gap-7 sm:pr-7">
      {items.map((c, i) => (
        <li key={`${i}-${c}`} className="flex items-center gap-6 sm:gap-7">
          {c}
          <Sparkles aria-hidden className="size-3.5 text-accent sm:size-5" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee overflow-hidden border-b-[5px] border-lilac bg-orange text-ink">
      <div className="marquee-track flex w-max py-2.5 font-groove text-lg leading-tight sm:py-4 sm:text-[1.6rem]">
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}

/**
 * White tile with a round icon, as in "Why Haircraft360" on the home page.
 * `layout="row"` puts the icon beside the text from the `lg` size up, for a single column of tiles.
 */
export function IconTile({
  icon: Icon,
  title,
  children,
  tone = "orange",
  layout = "stack",
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children?: React.ReactNode;
  tone?: "orange" | "lilac";
  layout?: "stack" | "row";
}) {
  const row = layout === "row";
  return (
    <div className={cx("h-full rounded-[20px] border border-line bg-surface p-5 shadow-[0_18px_36px_-28px_rgb(46_29_45/0.4)] sm:p-6", row && "lg:flex lg:items-start lg:gap-5")}>
      <span className={cx("grid size-12 shrink-0 place-items-center rounded-full text-ink", tone === "orange" ? "bg-orange" : "bg-lilac")}>
        <Icon aria-hidden className="size-[22px]" />
      </span>
      <div className={cx("mt-4", row && "lg:mt-0")}>
        <h3 className="font-serif text-xl font-semibold leading-tight sm:text-[1.4rem]">{title}</h3>
        {children && <div className="mt-2 text-[0.94rem] text-ink-2">{children}</div>}
      </div>
    </div>
  );
}
