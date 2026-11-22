import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, ExternalLink, GraduationCap, LogOut, Settings2, Wallet } from "lucide-react";
import { adminChrome } from "@/server/admin-chrome";
import { PageHeader } from "@/components/admin/bits";
import { initials } from "@/components/admin/admin-topbar";
import { Skeleton } from "@/components/ui/primitives";
import { logoutAction } from "../../auth-actions";

export const metadata: Metadata = { title: "More" };

/** Phone only in practice: the sections that don't fit the bottom bar. Each page is listed in one place only. */
export default function MorePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <More />
    </Suspense>
  );
}

const card = "overflow-hidden rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)]";

async function More() {
  const { name, counts } = await adminChrome();
  const groups = [
    {
      title: "Business",
      items: [
        { href: "/admin/finances", label: "Finances", hint: "Takings, expenses and the daily summary", icon: Wallet },
        {
          href: "/admin/applications",
          label: "Locs Mastery",
          hint: counts.applications > 0 ? `${counts.applications} new application${counts.applications === 1 ? "" : "s"}` : "Programs and applications",
          icon: GraduationCap,
          count: counts.applications,
        },
      ],
    },
    {
      title: "Salon",
      items: [{ href: "/admin/settings", label: "Settings", hint: "Services, hours, deposit and messages", icon: Settings2 }],
    },
  ];

  return (
    <>
      <PageHeader title="More" />
      <div className="mx-auto max-w-xl space-y-5">
        <Link href="/admin/account" className={`${card} flex items-center gap-3 p-3.5 hover:bg-sand/40`}>
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-lilac text-sm font-bold text-night">{initials(name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{name}</span>
            <span className="block text-xs text-ink-3">Account, password and 2FA</span>
          </span>
          <ChevronRight aria-hidden className="size-4 text-ink-3" />
        </Link>

        {groups.map((g) => (
          <section key={g.title} aria-labelledby={`more-${g.title}`}>
            <h2 id={`more-${g.title}`} className="mb-1.5 px-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-3">{g.title}</h2>
            <ul className={`${card} divide-y divide-accent-soft`}>
              {g.items.map((item) => (
                <li key={item.href}>
                  <MoreRow {...item} />
                </li>
              ))}
              {g.title === "Salon" && (
                <li>
                  <MoreRow href="/" label="View public site" hint="Opens in a new tab" icon={ExternalLink} external />
                </li>
              )}
            </ul>
          </section>
        ))}

        <form action={logoutAction}>
          <button className={`${card} flex min-h-12 w-full items-center justify-center gap-2.5 text-sm font-semibold text-danger hover:bg-danger-soft`}>
            <LogOut aria-hidden className="size-[18px]" /> Sign out
          </button>
        </form>
      </div>
    </>
  );
}

function MoreRow({ href, label, hint, icon: Icon, count = 0, external }: { href: string; label: string; hint: string; icon: typeof Wallet; count?: number; external?: boolean }) {
  return (
    <Link href={href} target={external ? "_blank" : undefined} className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 hover:bg-sand/40">
      <span aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-accent-soft text-accent-text">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{label}</span>
        <span className="block text-xs text-ink-3">{hint}</span>
      </span>
      {count > 0 && <span aria-hidden className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-accent px-1.5 text-[0.68rem] font-bold text-on-accent">{count}</span>}
      {external ? <ExternalLink aria-hidden className="size-4 text-ink-3" /> : <ChevronRight aria-hidden className="size-4 text-ink-3" />}
    </Link>
  );
}
