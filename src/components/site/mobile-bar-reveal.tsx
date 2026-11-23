"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * A phone action bar that appears only when it is useful. Hidden while the element `watch`
 * (the hero's own buttons) is on screen or still below; it slides up once that has scrolled away.
 * With `hideWhileVisible`, it also slides away while that element (say, the form it points to)
 * is on screen. While hidden it is inert, so keyboard and screen reader users never land on it.
 */
export function MobileBarReveal({
  watch,
  hideWhileVisible,
  className,
  children,
}: {
  watch: string;
  hideWhileVisible?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [pastWatch, setPastWatch] = useState(false);
  const [targetInView, setTargetInView] = useState(false);
  const shown = pastWatch && !targetInView;

  useEffect(() => {
    const watched = document.getElementById(watch);
    if (!watched || typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setPastWatch(true));
      return () => cancelAnimationFrame(frame);
    }
    const io = new IntersectionObserver(([e]) => setPastWatch(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(watched);
    const target = hideWhileVisible ? document.getElementById(hideWhileVisible) : null;
    const io2 = target ? new IntersectionObserver(([e]) => setTargetInView(e.isIntersecting)) : null;
    if (target) io2!.observe(target);
    return () => {
      io.disconnect();
      io2?.disconnect();
    };
  }, [watch, hideWhileVisible]);

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
