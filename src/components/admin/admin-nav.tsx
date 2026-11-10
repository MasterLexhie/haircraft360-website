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
export function AdminNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return <AdminNavList orientation={orientation} pathname={usePathname()} />;
}

export function AdminNavList({ orientation, pathname }: { orientation: "vertical" | "horizontal"; pathname: string | null }) {
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
                className={cx(
                  "flex items-center rounded-[var(--radius)] font-medium transition-colors",
                  orientation === "vertical" ? "min-h-11 gap-3 px-3 text-sm" : "min-h-12 flex-col justify-center gap-0.5 px-1 text-[0.7rem]",
                  active ? "bg-accent text-on-accent" : "text-ink-2 hover:bg-sand hover:text-ink",
                )}
              >
                <item.icon aria-hidden className={orientation === "vertical" ? "size-4" : "size-5"} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
