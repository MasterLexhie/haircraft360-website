"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, LayoutDashboard, LayoutGrid, MessageCircle, Settings2, Users, Wallet } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import type { NavCounts } from "@/server/admin-chrome";

type CountKey = keyof NavCounts;
type Item = { href: string; label: string; shortLabel?: string; icon: typeof LayoutDashboard; exact?: boolean; count?: CountKey };

/** Sidebar and icon rail: every section. */
const SIDEBAR: Item[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/reminders", label: "Reminders due", shortLabel: "Reminders", icon: MessageCircle, count: "reminders" },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/finances", label: "Finances", icon: Wallet },
  { href: "/admin/applications", label: "Locs Mastery", shortLabel: "Mastery", icon: GraduationCap, count: "applications" },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

/** Phone bottom bar: the four daily sections, then More for everything else (each page sits in one place only). */
const BOTTOM: Item[] = [
  SIDEBAR[0],
  SIDEBAR[1],
  SIDEBAR[2],
  SIDEBAR[3],
  { href: "/admin/more", label: "More", icon: LayoutGrid },
];

/** Pages that live behind More on a phone, so the More tab lights up on them. */
const MORE_PATHS = ["/admin/more", "/admin/finances", "/admin/applications", "/admin/settings", "/admin/account"];

function isActive(item: Item, pathname: string | null): boolean {
  if (!pathname) return false;
  if (item.href === "/admin/more") return MORE_PATHS.some((p) => pathname.startsWith(p));
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function countFor(item: Item, counts: NavCounts): number {
  if (item.href === "/admin/more") return counts.applications;
  return item.count ? counts[item.count] : 0;
}

export type NavVariant = "sidebar" | "rail" | "bottom";

/** Pathname-aware nav. Must render inside <Suspense> (dynamic routes). */
export function AdminNav({ variant, counts }: { variant: NavVariant; counts: NavCounts }) {
  return <AdminNavList variant={variant} counts={counts} pathname={usePathname()} />;
}

export function AdminNavList({ variant, counts, pathname }: { variant: NavVariant; counts: NavCounts; pathname: string | null }) {
  const items = variant === "bottom" ? BOTTOM : SIDEBAR;
  return (
    <nav aria-label="Admin">
      <ul className={variant === "bottom" ? "grid grid-cols-5 gap-1" : "space-y-0.5"}>
        {items.map((item) => {
          const active = isActive(item, pathname);
          const count = countFor(item, counts);
          const countLabel = count > 0 ? `, ${count} waiting` : "";
          if (variant === "sidebar") {
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                    active ? "bg-surface font-bold text-accent-text shadow-[0_1px_2px_rgb(62_40_61/0.10)]" : "font-medium text-ink-2 hover:bg-surface/60 hover:text-ink",
                  )}
                >
                  <item.icon aria-hidden className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}<span className="sr-only">{countLabel}</span></span>
                  {count > 0 && <CountPill count={count} tone={active ? "plum" : "soft"} />}
                </Link>
              </li>
            );
          }
          const label = item.shortLabel ?? item.label;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={variant === "rail" ? item.label : undefined}
                className={cx(
                  "relative flex flex-col items-center justify-center gap-1 rounded-[10px] text-center transition-colors",
                  variant === "rail" ? "min-h-14 px-1 text-[0.66rem]" : "min-h-12 px-0.5 text-[0.7rem] max-[359px]:text-[0.6rem]",
                  active ? "bg-accent-soft font-bold text-accent-text" : "font-medium text-ink-3 hover:bg-sand hover:text-ink",
                )}
              >
                <item.icon aria-hidden className="size-5 shrink-0" />
                <span aria-hidden>{label}</span>
                <span className="sr-only">{item.label}{countLabel}</span>
                {count > 0 && <CountPill count={count} tone="plum" floating />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function CountPill({ count, tone, floating }: { count: number; tone: "plum" | "soft"; floating?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.66rem] font-bold tabular",
        tone === "plum" ? "bg-accent text-on-accent" : "bg-sand-2 text-ink-2",
        floating && "absolute left-[calc(50%+4px)] top-0.5 h-[18px] min-w-[18px] px-1 text-[0.6rem] ring-2 ring-surface",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
