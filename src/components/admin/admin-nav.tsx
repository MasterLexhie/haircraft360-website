"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, Settings2, Users } from "lucide-react";
import { cx } from "@/components/ui/primitives";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
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
      <ul className={orientation === "vertical" ? "space-y-1" : "grid grid-cols-4 gap-1"}>
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : !!pathname?.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cx(
                  "flex items-center rounded-[var(--radius)] font-medium transition-colors",
                  orientation === "vertical" ? cx("min-h-11 gap-3 text-sm", collapsed ? "justify-center px-0" : "px-3") : "min-h-12 flex-col justify-center gap-0.5 px-1 text-[0.7rem]",
                  active ? "bg-accent text-on-accent" : "text-ink-2 hover:bg-sand hover:text-ink",
                )}
              >
                <item.icon aria-hidden className={cx("shrink-0", orientation === "vertical" ? "size-4" : "size-5")} />
                <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
