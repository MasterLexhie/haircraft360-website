"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, LayoutDashboard, MessageCircle, Settings2, UserRoundCog, Users, Wallet } from "lucide-react";
import { cx } from "@/components/ui/primitives";

/** `sidebarOnly`: on phones it sits in the top bar instead, so five items fit the bottom bar. */
const ITEMS: { href: string; label: string; shortLabel?: string; icon: typeof LayoutDashboard; exact?: boolean; sidebarOnly?: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/reminders", label: "Reminders due", shortLabel: "Reminders", icon: MessageCircle },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/finances", label: "Finances", icon: Wallet },
  { href: "/admin/applications", label: "Locs Mastery", icon: GraduationCap, sidebarOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings2, sidebarOnly: true },
  { href: "/admin/account", label: "Account", icon: UserRoundCog, sidebarOnly: true },
];

/** Pathname-aware nav. Must render inside <Suspense> (dynamic routes). */
export function AdminNav({ orientation, collapsed = false }: { orientation: "vertical" | "horizontal"; collapsed?: boolean }) {
  return <AdminNavList orientation={orientation} pathname={usePathname()} collapsed={collapsed} />;
}

export function AdminNavList({
  orientation,
  pathname,
  collapsed = false,
}: {
  orientation: "vertical" | "horizontal";
  pathname: string | null;
  /** Vertical only: icon rail with the label kept for screen readers and as a tooltip. */
  collapsed?: boolean;
}) {
  return (
    <nav aria-label="Admin">
      <ul className={orientation === "vertical" ? "space-y-1" : "grid grid-cols-5 gap-1"}>
        {ITEMS.filter((item) => orientation === "vertical" || !item.sidebarOnly).map((item) => {
          const active = item.exact ? pathname === item.href : !!pathname?.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cx(
                  "flex items-center rounded-[var(--radius)] font-medium transition-colors",
                  orientation === "vertical" ? cx("min-h-11 gap-3 text-sm", collapsed ? "justify-center px-0" : "px-3") : "min-h-12 flex-col justify-center gap-0.5 px-1 text-[0.7rem] max-[359px]:px-0 max-[359px]:text-[0.6rem]",
                  active ? "bg-accent text-on-accent" : "text-ink-2 hover:bg-sand hover:text-ink",
                )}
              >
                <item.icon aria-hidden className={cx("shrink-0", orientation === "vertical" ? "size-4" : "size-5")} />
                {orientation === "horizontal" && item.shortLabel ? (
                  <span>
                    <span aria-hidden>{item.shortLabel}</span>
                    <span className="sr-only">{item.label}</span>
                  </span>
                ) : (
                  <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
