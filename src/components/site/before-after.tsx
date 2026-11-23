"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import type { StockPhoto } from "@/config/stock-photos";
import { cx } from "@/components/ui/primitives";

/**
 * Before and after of the same client: drag the handle (or use the arrow keys) to compare.
 * A native range input drives it, so it works with the keyboard, touch and screen readers.
 * Only for real pairs of one client; never for stock photos of different people.
 */
export function BeforeAfter({ before, after, label, sizes, className }: { before: StockPhoto; after: StockPhoto; label: string; sizes: string; className?: string }) {
  const [split, setSplit] = useState(50);
  const id = useId();
  return (
    <div className={cx("relative overflow-hidden", className)}>
      <Image src={after.src} alt={after.alt} fill sizes={sizes} className="object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
        <Image src={before.src} alt={before.alt} fill sizes={sizes} className="object-cover" />
      </div>
      <span aria-hidden className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-on-night">Before</span>
      <span aria-hidden className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-on-night">After</span>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-cream" style={{ left: `${split}%` }}>
        <span className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cream text-ink shadow-lg">
          <ChevronsLeftRight className="size-5" />
        </span>
      </span>
      <label htmlFor={id} className="sr-only">
        {label}: slide to compare before and after
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        aria-valuetext={`${split}% before`}
        className="absolute inset-0 size-full cursor-ew-resize appearance-none opacity-0"
      />
    </div>
  );
}
