"use client";

import { useEffect, useState, type ReactNode } from "react";
import { buttonClass, cx } from "@/components/ui/primitives";

export type DetailTabId = "overview" | "payments" | "messages" | "activity";

/**
 * Phone only: section tabs under the page header. Every section is rendered on the server;
 * the tabs just choose which ones show, so from tablet up the whole page is visible at once.
 * Sections are wrapped in <TabSection>. A link to #messages, #move or #complete opens the
 * tab that holds it. `collect` adds a bar above the bottom menu that opens Payments.
 */
export function DetailTabs({ tabs, children, collect }: { tabs: { id: DetailTabId; label: string; count?: number }[]; children: ReactNode; collect?: string }) {
  const [active, setActive] = useState<DetailTabId>("overview");

  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      const tab: DetailTabId | null = hash === "messages" ? "messages" : hash === "payments" ? "payments" : hash === "move" || hash === "complete" ? "overview" : null;
      if (!tab) return;
      setActive(tab);
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const open = (id: DetailTabId) => {
    setActive(id);
    document.getElementById("admin-scroll")?.scrollTo({ top: 0 });
  };

  return (
    <div className="group/tabs" data-active={active}>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 border-b border-line bg-surface md:hidden">
      <div role="tablist" aria-label="Booking sections" className="flex overflow-x-auto px-2 pr-8">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === active}
            onClick={() => open(t.id)}
            className={cx(
              "-mb-px inline-flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-[3px] px-2 text-[0.8125rem] font-semibold",
              t.id === active ? "border-accent text-accent-text" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
            {!!t.count && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-soft px-1 text-[0.62rem] font-bold text-accent-text">{t.count}</span>}
          </button>
        ))}
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent to-surface" />
      </div>
      {children}
      {collect && active !== "payments" && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-line bg-surface px-4 py-2.5 shadow-[0_-6px_16px_-12px_rgb(62_40_61/0.35)] md:hidden">
          <button type="button" onClick={() => open("payments")} className={buttonClass("primary", "lg", "w-full")}>
            {collect}
          </button>
        </div>
      )}
    </div>
  );
}

/** Written out in full so Tailwind sees every class. */
const SHOW: Record<DetailTabId, string> = {
  overview: "max-md:group-data-[active=overview]/tabs:block",
  payments: "max-md:group-data-[active=payments]/tabs:block",
  messages: "max-md:group-data-[active=messages]/tabs:block",
  activity: "max-md:group-data-[active=activity]/tabs:block",
};

/** One section of the page, shown on a phone only while its tab is open. */
export function TabSection({ tab, children, className, id }: { tab: DetailTabId; children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={cx("max-md:hidden", SHOW[tab], className)}>
      {children}
    </div>
  );
}
