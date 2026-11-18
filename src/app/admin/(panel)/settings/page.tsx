import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Scissors } from "lucide-react";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { getAdminData } from "@/server/queries";
import { PageHeader } from "@/components/admin/bits";
import { AvailabilityForm, ServicesManager } from "@/components/admin/settings-forms";
import { Skeleton, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "services", label: "Services", icon: Scissors },
  { id: "availability", label: "Availability & deposit", icon: Clock },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SettingsView searchParams={searchParams} />
    </Suspense>
  );
}

async function SettingsView({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const [db, sp] = await Promise.all([getAdminData(), searchParams]);
  const tab: TabId = TABS.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : "services";
  return (
    <>
      <PageHeader title="Settings" description="Services, opening hours, capacity and the deposit rule. Changes apply to new bookings only." />

      <nav aria-label="Settings sections" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <li key={t.id}>
                <Link
                  href={t.id === "services" ? "/admin/settings" : `/admin/settings?tab=${t.id}`}
                  aria-current={active ? "page" : undefined}
                  scroll={false}
                  className={cx(
                    "-mb-px flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors",
                    active ? "border-accent text-accent-text" : "border-transparent text-ink-3 hover:border-line-strong hover:text-ink",
                  )}
                >
                  <t.icon aria-hidden className="size-4" />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "services" && <ServicesManager services={db.services} />}

      {tab === "availability" && (
        <AvailabilityForm settings={db.settings} />
      )}

    </>
  );
}
