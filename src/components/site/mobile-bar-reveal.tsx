"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * The phone booking bar on the home page. Hidden while the hero's own buttons are on screen,
 * it slides up once they scroll away, so there is always one clear way to book and never two.
 * While hidden it is inert, so keyboard and screen reader users never land on it.
 */
export function MobileBarReveal({ watch, className, children }: { watch: string; className?: string; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watch);
    if (!target || typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(target);
    return () => io.disconnect();
  }, [watch]);

  return (
    <div
      inert={!shown}
      aria-hidden={!shown || undefined}
      className={cx(
        "transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
        shown ? "translate-y-0" : "translate-y-[110%]",
        className,
      )}
    >
      {children}
    </div>
  );
}
