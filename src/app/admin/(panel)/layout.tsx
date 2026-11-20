import Image from "next/image";
import Link from "next/link";
import { LogOut, UserRoundCog } from "lucide-react";
import { Suspense } from "react";
import { AdminNav, AdminNavList } from "@/components/admin/admin-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { logoutAction } from "../auth-actions";

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
          <span className="flex items-center gap-1">
            <Link href="/admin/account" className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius)] px-2 text-sm text-ink-2 hover:bg-sand">
              <UserRoundCog aria-hidden className="size-4" /> <span className="sr-only min-[400px]:not-sr-only">Account</span>
            </Link>
            <form action={logoutAction}>
              <button className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius)] px-2 text-sm text-ink-2 hover:bg-sand">
                <LogOut aria-hidden className="size-4" /> <span className="sr-only min-[400px]:not-sr-only">Sign out</span>
              </button>
            </form>
          </span>
        </header>

        <div id="admin-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
