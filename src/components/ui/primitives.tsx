import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { Tone } from "@/domain/labels";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ───────────── Buttons ───────────── */

type Size = "sm" | "md" | "lg";

/*
 * Buttons: small tracked uppercase labels on near-square plum fills
 * (primary) or plum outlines (secondary). "light" is for dark plum grounds.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "night" | "light";
const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 font-bold uppercase tracking-[0.14em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:opacity-45 disabled:cursor-not-allowed disabled:active:translate-y-0 select-none";
const variants: Record<Variant, string> = {
  primary: "border-accent bg-accent text-on-accent hover:border-accent-hover hover:bg-accent-hover",
  secondary: "border-accent bg-transparent text-accent-text hover:bg-accent-soft",
  ghost: "border-transparent text-ink-2 hover:bg-sand hover:text-ink",
  danger: "border-danger/50 bg-surface text-danger hover:bg-danger-soft",
  night: "border-night bg-night text-on-night hover:border-ink-2 hover:bg-ink-2",
  light: "border-on-night bg-on-night text-accent-text hover:border-lilac hover:bg-lilac",
};
const sizes: Record<Size, string> = {
  sm: "min-h-10 px-4 text-[0.7rem]",
  md: "min-h-11 px-5 text-[0.75rem]",
  lg: "min-h-12 px-7 text-[0.8rem]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)}>
      {loading && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

/* ───────────── Badges ───────────── */

const toneClass: Record<Tone, string> = {
  neutral: "bg-sand text-ink-2 border-line-strong",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  info: "bg-info-soft text-info border-info/25",
  accent: "bg-accent-soft text-accent-text border-accent/40",
};
const toneDot: Record<Tone, string> = {
  neutral: "bg-ink-3",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  accent: "bg-accent",
};

/** Status label: always text + a shape, never colour alone. */
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", toneClass[tone], className)}>
      <span aria-hidden className={cx("size-1.5 rounded-full", toneDot[tone])} />
      {children}
    </span>
  );
}

/** Marks sample values that are not owner-approved. */
export function DemoTag({ children = "Demo", className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded border border-dashed border-ink-3/60 bg-surface px-1.5 py-px text-[0.7rem] font-semibold uppercase tracking-wide text-ink-2", className)}>
      {children}
    </span>
  );
}

/* ───────────── Alerts ───────────── */

const alertIcon = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle } as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const Icon = alertIcon[tone];
  return (
    <div role={role} className={cx("flex gap-3 rounded-[var(--radius)] border p-4 text-sm", toneClass[tone], className)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1 text-ink">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-2 [&_a]:font-semibold [&_a]:text-ink [&_a]:underline">{children}</div>}
      </div>
    </div>
  );
}

/* ───────────── Cards & layout ───────────── */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx("rounded-[var(--radius)] border border-line bg-surface", className)} />;
}

/**
 * Section heading. "serif" = light Playfair headline (editorial sections);
 * "caps" = bold tracked uppercase (utility sections). Optional centring.
 */
export function SectionHeading({
  eyebrow,
  title,
  children,
  id,
  variant = "serif",
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  id?: string;
  variant?: "serif" | "caps";
  align?: "left" | "center";
}) {
  return (
    <div className={cx("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className="type-caps mb-3 text-[0.72rem] text-ink-3">{eyebrow}</p>}
      <h2
        id={id}
        className={cx(
          variant === "serif" ? "type-display text-[2.1rem] sm:text-[2.6rem]" : "type-caps text-xl text-accent-text sm:text-[1.65rem] sm:tracking-[0.18em]",
        )}
      >
        {title}
      </h2>
      {children && <p className="mt-4 text-base text-ink-2 sm:text-lg">{children}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius)] border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-[var(--radius)] bg-sand-2/70", className)} />;
}

/* ───────────── Form fields ───────────── */

export const inputClass =
  "block w-full min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3.5 py-2 text-base text-ink placeholder:text-ink-3 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/30";

export function Field({
  id,
  label,
  hint,
  error,
  required,
  optional,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-danger" aria-hidden> *</span>}
        {optional && <span className="font-normal text-ink-3"> (optional)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="text-sm text-ink-3">{hint}</p>}
      {children}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <XCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, opts: { hint?: boolean; error?: boolean }) {
  return [opts.hint && `${id}-hint`, opts.error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}
