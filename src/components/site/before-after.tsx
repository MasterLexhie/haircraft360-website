"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import type { StockPhoto } from "@/config/stock-photos";
import { cx } from "@/components/ui/primitives";

/**
 * Before and after of the same client. Drag anywhere on the photo (mouse or finger) to move the
 * divider; on phones a sideways drag moves it while an up or down swipe still scrolls the page.
 * A hidden range input carries the keyboard and screen reader side (arrow keys, Home, End).
 * Only for real pairs of one client; never for stock photos of different people.
 */
export function BeforeAfter({ before, after, label, sizes, className }: { before: StockPhoto; after: StockPhoto; label: string; sizes: string; className?: string }) {
  const [split, setSplit] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const id = useId();

  const moveTo = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setSplit(Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))));
  };

  return (
    <div
      ref={box}
      className={cx(
        "relative touch-pan-y select-none overflow-hidden has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        className,
      )}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) moveTo(e.clientX);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <Image src={after.src} alt={after.alt} fill sizes={sizes} draggable={false} className="object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
        <Image src={before.src} alt={before.alt} fill sizes={sizes} draggable={false} className="object-cover" />
      </div>
      <span aria-hidden className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-on-night">Before</span>
      <span aria-hidden className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-on-night">After</span>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-cream" style={{ left: `${split}%` }}>
        <span className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cream text-ink shadow-lg">
          <ChevronsLeftRight className="size-5" />
        </span>
      </span>
      <label htmlFor={id} className="sr-only">
        {label}: compare before and after
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        aria-valuetext={`${split}% showing before`}
        className="pointer-events-none absolute inset-0 size-full appearance-none opacity-0"
      />
    </div>
  );
}
