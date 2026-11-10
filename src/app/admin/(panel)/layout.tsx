import Image from "next/image";
import Link from "next/link";
import { ExternalLink, LogOut, ShieldAlert } from "lucide-react";
import { Suspense } from "react";
import { AdminNav, AdminNavList } from "@/components/admin/admin-nav";
import { logoutAction } from "../actions";

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-sand lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
          <Image src="/brand/logo-pink-full.webp" alt="" width={569} height={571} className="size-9" />
          <span className="flex flex-col leading-tight">
            <span className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-accent-text">Haircraft<span className="font-display text-base normal-case italic tracking-normal">360</span></span>
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-3">Salon admin · demo</span>
          </span>
        </div>
        <div className="flex-1 p-3">
          <Suspense fallback={<AdminNavList orientation="vertical" pathname={null} />}>
            <AdminNav orientation="vertical" />
          </Suspense>
        </div>
        <div className="space-y-1 border-t border-line p-3">
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 text-sm text-ink-2 hover:bg-sand hover:text-ink">
            <ExternalLink aria-hidden className="size-4" /> View public site
          </Link>
          <form action={logoutAction}>
            <button className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius)] px-3 text-sm text-ink-2 hover:bg-sand hover:text-ink">
              <LogOut aria-hidden className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
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
        <p className="flex items-center gap-2 border-b border-warning/20 bg-warning-soft px-4 py-2 text-xs text-warning sm:px-6">
          <ShieldAlert aria-hidden className="size-3.5 shrink-0" />
          Demo admin. Sign-in is not production security, all records are demo data, and no payment is real.
        </p>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-2 py-1.5 lg:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
          <Suspense fallback={<AdminNavList orientation="horizontal" pathname={null} />}>
            <AdminNav orientation="horizontal" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
