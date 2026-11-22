"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { AdminNav, AdminNavList } from "@/components/admin/admin-nav";
import type { NavCounts } from "@/server/admin-chrome";

const STORAGE_KEY = "hc360-admin-sidebar";

/**
 * Sits on the grey workspace under the top bar and never scrolls; the page beside it does.
 * Tablets (md) always get the icon rail. Desktops (lg) get the full sidebar, which can be
 * collapsed to the rail; the choice is remembered per browser.
 */
export function AdminSidebar({ counts, logoutAction }: { counts: NavCounts; logoutAction: () => Promise<void> }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // Restore the saved preference after hydration (localStorage is browser-only).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "collapsed") setCollapsed(true);
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  };

  return (
    <>
      <Rail counts={counts} logoutAction={logoutAction} className={cx("md:flex", collapsed ? "lg:flex" : "lg:hidden")} toggle={collapsed ? toggle : undefined} />

      <aside aria-label="Sidebar" className={cx("hidden w-[244px] shrink-0 flex-col overflow-y-auto px-3 py-4", !collapsed && "lg:flex")}>
        <div className="min-h-0 flex-1">
          <Suspense fallback={<AdminNavList variant="sidebar" counts={counts} pathname={null} />}>
            <AdminNav variant="sidebar" counts={counts} />
          </Suspense>
        </div>
        <div className="mt-4 space-y-0.5 border-t border-line pt-3">
          <Link href="/" target="_blank" className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface/60 hover:text-ink">
            <ExternalLink aria-hidden className="size-4 shrink-0" /> View public site
          </Link>
          <form action={logoutAction}>
            <button className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface/60 hover:text-ink">
              <LogOut aria-hidden className="size-4 shrink-0" /> Sign out
            </button>
          </form>
          <button
            type="button"
            onClick={toggle}
            aria-expanded
            className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-3 hover:bg-surface/60 hover:text-ink"
          >
            <PanelLeftClose aria-hidden className="size-4 shrink-0" /> Collapse sidebar
          </button>
        </div>
      </aside>
    </>
  );
}

function Rail({ counts, logoutAction, className, toggle }: { counts: NavCounts; logoutAction: () => Promise<void>; className: string; toggle?: () => void }) {
  const iconButton = "flex min-h-11 w-full items-center justify-center rounded-[10px] text-ink-3 hover:bg-sand hover:text-ink";
  return (
    <aside aria-label="Sidebar" className={cx("hidden w-[76px] shrink-0 flex-col overflow-y-auto border-r border-sand-2 bg-surface px-2 py-3", className)}>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<AdminNavList variant="rail" counts={counts} pathname={null} />}>
          <AdminNav variant="rail" counts={counts} />
        </Suspense>
      </div>
      <div className="mt-3 space-y-1 border-t border-line pt-3">
        <Link href="/" target="_blank" title="View public site" className={iconButton}>
          <ExternalLink aria-hidden className="size-[18px]" /><span className="sr-only">View public site</span>
        </Link>
        <form action={logoutAction}>
          <button title="Sign out" className={iconButton}>
            <LogOut aria-hidden className="size-[18px]" /><span className="sr-only">Sign out</span>
          </button>
        </form>
        {toggle && (
          <button type="button" onClick={toggle} aria-expanded={false} title="Expand sidebar" className={cx(iconButton, "max-lg:hidden")}>
            <PanelLeftOpen aria-hidden className="size-[18px]" /><span className="sr-only">Expand sidebar</span>
          </button>
        )}
      </div>
    </aside>
  );
}
