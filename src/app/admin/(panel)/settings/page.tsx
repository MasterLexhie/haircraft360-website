import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Clock, Scissors } from "lucide-react";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { getAdminData } from "@/server/queries";
import { business } from "@/config/business";
import { PageHeader, Panel } from "@/components/admin/bits";
import { AvailabilityForm, OwnerChecklist, ResetDemoButton, ServicesManager } from "@/components/admin/settings-forms";
import { Badge, Skeleton, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "services", label: "Services", icon: Scissors },
  { id: "availability", label: "Availability & deposit", icon: Clock },
  { id: "owner", label: "Needs owner confirmation", icon: ClipboardCheck },
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
  const done = db.settings.checklist.filter((c) => c.done).length;
  const facts = [
    { label: "Listing title", value: business.listingTitle.value, verified: business.listingTitle.verified },
    { label: "Address", value: Object.values(business.address.value).join(", "), verified: business.address.verified },
    { label: "Phone", value: business.phone.value.display, verified: business.phone.verified },
    { label: "Hours", value: business.listedHoursSummary.value, verified: business.listedHoursSummary.verified },
    {
      label: "Rating snapshot",
      value: `${business.ratingSnapshot.value.rating.toFixed(1)} from ${business.ratingSnapshot.value.count} Google reviews (fetched ${business.ratingSnapshot.value.fetched}) — ${business.ratingSnapshot.approvedForDisplay ? "shown" : "hidden"} on the public site`,
      verified: business.ratingSnapshot.verified,
    },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Every value here is demo data until the owner confirms it." actions={<ResetDemoButton />} />

      <nav aria-label="Settings sections" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.map((t) => {
            const active = t.id === tab;
            const count = t.id === "owner" ? `${done}/${db.settings.checklist.length}` : null;
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
                  {count && (
                    <span className={cx("rounded-full px-2 py-0.5 text-xs tabular", active ? "bg-accent text-on-accent" : "bg-sand-2 text-ink-2")}>{count}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "services" && <ServicesManager services={db.services} defaultDuration={db.settings.availability.defaultDurationMinutes} />}

      {tab === "availability" && (
        <AvailabilityForm settings={db.settings} />
      )}

      {tab === "owner" && (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Panel title={`Needs owner confirmation (${done}/${db.settings.checklist.length})`}>
            <OwnerChecklist items={db.settings.checklist} />
            <p className="mt-3 text-xs text-ink-3">Ticking an item only tracks progress here. Update the matching config before launch.</p>
          </Panel>
          <Panel title="Business facts on the public site" className="lg:sticky lg:top-6">
            <ul className="space-y-3 text-sm">
              {facts.map((f) => (
                <li key={f.label}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink-3">{f.label}</span>
                    <Badge tone={f.verified ? "success" : "warning"}>{f.verified ? "Verified" : "Unverified"}</Badge>
                  </div>
                  <p className="mt-0.5 text-ink">{f.value}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-3">Source: {business.address.source}. Edit <code>src/config/business.ts</code> once confirmed.</p>
          </Panel>
        </div>
      )}
    </>
  );
}
