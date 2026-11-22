import { cx } from "@/components/ui/primitives";

export type PillKind = "pink" | "orange" | "plum" | "ghost" | "ghost-dark";

const kinds: Record<PillKind, string> = {
  pink: "bg-lilac text-ink hover:bg-[#f3a6f3]",
  orange: "bg-orange text-ink hover:bg-[#f7b347]",
  plum: "bg-accent text-on-accent hover:bg-accent-hover",
  ghost: "border-[1.5px] border-accent text-accent-text hover:bg-accent-soft",
  "ghost-dark": "border-[1.5px] border-on-night/50 text-on-night hover:border-lilac hover:text-lilac",
};

/** Public site buttons: flat rounded pills, Studio Groove colours. */
export function pill(kind: PillKind = "pink", size: "sm" | "md" | "lg" = "lg", className?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-full font-bold transition-colors",
    size === "lg" ? "min-h-13 px-6 text-[0.95rem]" : size === "md" ? "min-h-11 px-5 text-[0.9rem]" : "min-h-10 px-4 text-[0.9rem]",
    kinds[kind],
    className,
  );
}
