"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { ExternalLink, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { AdminNav, AdminNavList } from "@/components/admin/admin-nav";

const STORAGE_KEY = "hc360-admin-sidebar";

/**
 * Desktop sidebar. Fixed to the viewport height (never scrolls); the page
 * content beside it is the scroll area. Collapses to an icon rail, and the
 * choice is remembered per browser.
 */
export function AdminSidebar({ logoutAction }: { logoutAction: () => Promise<void> }) {
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

  const itemClass = cx(
    "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius)] text-sm text-ink-2 hover:bg-sand hover:text-ink",
    collapsed ? "justify-center px-0" : "px-3",
  );

  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] text-ink-3 hover:bg-sand hover:text-ink"
    >
      {collapsed ? <PanelLeftOpen aria-hidden className="size-[18px]" /> : <PanelLeftClose aria-hidden className="size-[18px]" />}
    </button>
  );

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cx(
        "hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-line bg-surface transition-[width] duration-200 lg:flex",
        collapsed ? "w-[76px]" : "w-[280px]",
      )}
    >
      <div
        className={cx(
          "flex shrink-0 border-b border-line",
          collapsed ? "flex-col items-center gap-1 px-2 py-3" : "h-16 items-center gap-2.5 pl-5 pr-2",
        )}
      >
        <Image src="/brand/logo-pink-full.webp" alt="" width={569} height={571} className="size-9 shrink-0" />
        {!collapsed && (
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-accent-text">
              Haircraft<span className="font-display text-base normal-case italic tracking-normal">360</span>
            </span>
            <span className="whitespace-nowrap text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-3">Salon admin · demo</span>
          </span>
        )}
        {toggleButton}
      </div>

      <div className="min-h-0 flex-1 p-3">
        <Suspense fallback={<AdminNavList orientation="vertical" pathname={null} collapsed={collapsed} />}>
          <AdminNav orientation="vertical" collapsed={collapsed} />
        </Suspense>
      </div>

      <div className="shrink-0 space-y-1 border-t border-line p-3">
        <Link href="/" className={itemClass} title={collapsed ? "View public site" : undefined}>
          <ExternalLink aria-hidden className="size-4 shrink-0" />
          <span className={collapsed ? "sr-only" : undefined}>View public site</span>
        </Link>
        <form action={logoutAction}>
          <button className={itemClass} title={collapsed ? "Sign out" : undefined}>
            <LogOut aria-hidden className="size-4 shrink-0" />
            <span className={collapsed ? "sr-only" : undefined}>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
