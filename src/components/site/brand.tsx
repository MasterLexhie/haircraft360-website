import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import type { StockPhoto as StockPhotoData } from "@/config/stock-photos";

/**
 * Header lock-up: the supplied pink/black badge (unaltered) + a typeset
 * wordmark — tracked caps "HAIRCRAFT" with an italic serif "360".
 */
export function LogoLockup({ className, href = "/", tone = "light" }: { className?: string; href?: string; tone?: "light" | "dark" }) {
  return (
    <Link href={href} className={cx("group inline-flex items-center gap-3 rounded-[var(--radius)]", className)} aria-label="Haircraft360 home">
      <Image src="/brand/logo-pink-full.webp" alt="" width={569} height={571} priority className="size-11 shrink-0" />
      <span className={cx("flex items-baseline gap-1 leading-none", tone === "light" ? "text-accent-text" : "text-on-night")}>
        <span className="text-[0.95rem] font-semibold uppercase tracking-[0.24em] sm:text-base">Haircraft</span>
        <span className={cx("font-display text-xl italic", tone === "dark" && "text-lilac")}>360</span>
      </span>
    </Link>
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
