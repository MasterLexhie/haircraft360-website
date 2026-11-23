"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { Service } from "@/domain/types";
import { addOnTerms } from "@/domain/pricing";
import { formatNaira } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import { Sticker } from "@/components/site/brand";
import { ServicePhoto } from "@/components/site/service-photo";
import { pill } from "@/components/site/pill";
import { cx } from "@/components/ui/primitives";

/** Counts a number towards its new value over about 400 ms; jumps straight there when motion is reduced. */
function useCountTo(target: number) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = duration ? Math.min(1, (now - t0) / duration) : 1;
      const eased = 1 - (1 - p) ** 3;
      const value = Math.round(start + (target - start) * eased);
      from.current = value;
      setShown(value);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

/**
 * "An example visit" on the home page: one main service and its extras. Customers tick the extras
 * they want, the total follows, and "Book this visit" opens the booking steps with them chosen.
 */
export function VisitCard({ main, addOns }: { main: Service; addOns: Service[] }) {
  const [ticked, setTicked] = useState<string[]>(() => addOns.slice(0, 2).map((a) => a.id));
  const chosen = addOns.filter((a) => ticked.includes(a.id));
  const total = main.priceKobo + chosen.reduce((sum, a) => sum + addOnTerms(a).priceKobo, 0);
  const shown = useCountTo(total);
  const href = `/book?service=${encodeURIComponent(main.id)}${chosen.length ? `&addons=${chosen.map((a) => encodeURIComponent(a.id)).join(",")}` : ""}`;

  const toggle = (id: string) => setTicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <figure className="relative rounded-3xl border border-cream-line bg-surface p-5 shadow-[0_30px_60px_-34px_rgb(46_29_45/0.45)] sm:p-8">
      <Sticker id="day-sticker" ring="HEAD TO TOE · HEAD TO TOE · " center="+1" fill="var(--lilac)" className="absolute -right-1 -top-10 size-20 rotate-[10deg] sm:-right-8 sm:-top-12 sm:size-28" />
      {main.photo && <ServicePhoto photo={main.photo} name={main.name} className="mb-5 aspect-[16/9] w-full rounded-2xl" />}
      <figcaption className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">Build your visit</figcaption>
      <p className="mt-3 flex items-baseline justify-between gap-4 border-b-2 border-dashed border-cream-line pb-3.5">
        <span className="font-serif text-[1.4rem] font-semibold sm:text-[1.6rem]">{main.name}</span>
        <strong className="tabular">{formatNaira(main.priceKobo)}</strong>
      </p>
      <fieldset className="mt-4">
        <legend className="mb-2.5 text-sm font-bold text-ink-2">Add to it</legend>
        <ul className="grid gap-2">
          {addOns.map((a) => {
            const on = ticked.includes(a.id);
            const terms = addOnTerms(a);
            return (
              <li key={a.id}>
                <label
                  className={cx(
                    "relative flex cursor-pointer items-center gap-3 rounded-[14px] border px-3.5 py-3 transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                    on ? "border-transparent bg-cream" : "border-cream-line hover:border-line-strong",
                  )}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="peer sr-only" />
                  <span
                    aria-hidden
                    className={cx(
                      "grid size-6 shrink-0 place-items-center rounded-[7px] transition-colors duration-200",
                      on ? "bg-accent text-on-accent" : "border-2 border-cream-line",
                    )}
                  >
                    <Check className={cx("size-4 transition-[transform,opacity] duration-200", on ? "scale-100 opacity-100" : "scale-50 opacity-0")} strokeWidth={3} />
                  </span>
                  <span className="flex-1 text-[0.94rem]">
                    <strong>{a.name}</strong>
                    <span className="block text-[0.8rem] text-ink-3">About {formatDuration(terms.durationMinutes)}</span>
                  </span>
                  <strong className="tabular text-[0.94rem]">+{formatNaira(terms.priceKobo)}</strong>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t-[1.5px] border-ink pt-4">
        <span>
          <span className="block text-sm text-ink-3">{[main, ...chosen].map((s) => s.name).join(", ")}</span>
          <span aria-hidden className="tabular font-serif text-[1.75rem] font-semibold sm:text-[2rem]">{formatNaira(shown)}</span>
          <span role="status" className="sr-only">Total {formatNaira(total)}</span>
        </span>
        <Link href={href} className={pill("plum", "md")}>
          Book this visit
        </Link>
      </div>
    </figure>
  );
}
