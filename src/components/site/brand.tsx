import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import type { StockPhoto as StockPhotoData } from "@/config/stock-photos";

/**
 * Lock-up for the dark header and footer: the supplied pink/black badge (unaltered)
 * and the wordmark in the Groove accent face, in the logo's pink.
 */
export function LogoLockup({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cx("group inline-flex items-center gap-3 rounded-[var(--radius)]", className)} aria-label="Haircraft360 home">
      <Image src="/brand/logo-pink-full.webp" alt="" width={569} height={571} priority className="size-10 shrink-0 rounded-full sm:size-12" />
      <span className="font-groove text-[1.2rem] leading-none text-lilac sm:text-[1.4rem]">Haircraft360</span>
    </Link>
  );
}

/**
 * Round badge with words running around its edge, like the logo's sticker rim.
 * Decorative only. `id` keeps the text path unique when two are on one page.
 */
export function Sticker({ id, ring, center, className, fill = "var(--color-orange)", ink = "var(--ink)" }: { id: string; ring: string; center: string; className?: string; fill?: string; ink?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 150 150" className={className}>
      <defs>
        <path id={id} d="M75 75m-52,0a52,52 0 1,1 104,0a52,52 0 1,1 -104,0" />
      </defs>
      <circle cx="75" cy="75" r="72" fill={fill} />
      <circle cx="75" cy="75" r="38" fill="none" stroke={ink} strokeWidth="1.5" strokeDasharray="2 5" />
      <g className="sticker-ring">
        <text fill={ink} fontFamily="var(--font-sans)" fontSize="12.5" fontWeight="700" letterSpacing="3">
          <textPath href={`#${id}`}>{ring}</textPath>
        </text>
      </g>
      <text x="75" y="84" textAnchor="middle" fill={ink} fontFamily="var(--font-groove)" fontSize="24">
        {center}
      </text>
    </svg>
  );
}

/** Soft wave between a light and a dark band. `flip` turns it upside down for the way back. */
export function Wave({ from, to, flip = false }: { from: string; to: string; flip?: boolean }) {
  return (
    // Tucked 1px into the next band (and drawn over it), so no hairline seam shows where the wave
    // lands on a fractional pixel, as phone browsers otherwise can.
    <div aria-hidden className={cx("relative z-[1] -mb-px leading-[0]", from)}>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className={cx("block h-8 w-full sm:h-14", flip && "-scale-y-100", to)}>
        <path d="M0 40 C 180 0, 360 80, 540 40 S 900 0, 1080 40 S 1260 80, 1440 40 L1440 80 L0 80 Z" fill="currentColor" />
      </svg>
    </div>
  );
}

/**
 * A real stock photograph standing in for owner-approved photography. Always
 * captioned "Stock stand-in" so it is never mistaken for Haircraft360's work.
 * Same ratio contract as PhotoPlaceholder, so swapping in the real photo causes no layout shift.
 */
export function StockPhoto({
  photo,
  label,
  ratio,
  sizes,
  priority = false,
  className,
}: {
  photo: StockPhotoData;
  label?: string;
  ratio: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={cx("relative overflow-hidden rounded-[var(--radius)] bg-sand", className)} style={{ aspectRatio: ratio }}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      <figcaption className="absolute bottom-0 right-0 m-2 max-w-[calc(100%-1rem)] rounded-[var(--radius-control)] bg-surface/90 px-2 py-1 text-[0.68rem] font-semibold leading-tight text-ink-2">
        Stock stand-in{label ? ` · ${label}` : ""}
      </figcaption>
    </figure>
  );
}

/**
 * Neutral stand-in for owner-approved photography. Aspect ratio is fixed to
 * avoid layout shift when real images replace it.
 */
export function PhotoPlaceholder({ label, ratio = "4/5", className, tone = "light" }: { label: string; ratio?: string; className?: string; tone?: "light" | "dark" }) {
  return (
    <figure
      className={cx(
        "relative flex items-end overflow-hidden rounded-[var(--radius)]",
        tone === "light" ? "photo-placeholder" : "bg-on-night/10 border border-on-night/15",
        className,
      )}
      style={{ aspectRatio: ratio }}
    >
      <ImageIcon aria-hidden className={cx("absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2", tone === "light" ? "text-accent/30" : "text-on-night/40")} />
      <figcaption className={cx("m-3 rounded-[var(--radius-control)] px-2 py-1 text-[0.7rem] font-semibold", tone === "light" ? "bg-surface/90 text-ink-2" : "bg-night/80 text-on-night-2")}>
        Photo placeholder · {label}
      </figcaption>
    </figure>
  );
}
