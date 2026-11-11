import Image from "next/image";
import { LogOut, ShieldAlert } from "lucide-react";
import { Suspense } from "react";
import { AdminNav, AdminNavList } from "@/components/admin/admin-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { logoutAction } from "../actions";

/**
 * App-shell layout: the frame is exactly the viewport height. The sidebar
 * (desktop) and the top bar + bottom nav (mobile) stay put; only the page
 * content area (#admin-scroll) scrolls.
 */
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-sand">
      <AdminSidebar logoutAction={logoutAction} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <span className="flex items-center gap-2">
            <Image src="/brand/logo-pink-full.webp" alt="" width={569} height={571} className="size-8" />
            <span className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-accent-text">Haircraft<span className="font-display text-sm normal-case italic tracking-normal">360</span> admin</span>
          </span>
          <form action={logoutAction}>
            <button className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius)] px-2 text-sm text-ink-2 hover:bg-sand">
              <LogOut aria-hidden className="size-4" /> Sign out
            </button>
          </form>
        </header>

        <div id="admin-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <p className="flex items-center gap-2 border-b border-warning/20 bg-warning-soft px-4 py-2 text-xs text-warning sm:px-6">
            <ShieldAlert aria-hidden className="size-3.5 shrink-0" />
            Demo admin. Sign-in is not production security, all records are demo data, and no payment is real.
          </p>
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>

        <div className="shrink-0 border-t border-line bg-surface px-2 py-1.5 lg:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
          <Suspense fallback={<AdminNavList orientation="horizontal" pathname={null} />}>
            <AdminNav orientation="horizontal" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
