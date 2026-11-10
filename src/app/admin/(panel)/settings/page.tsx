import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { getAdminData } from "@/server/queries";
import { business } from "@/config/business";
import { formatNaira } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/bits";
import { AvailabilityForm, OwnerChecklist, ResetDemoButton, ServiceForm } from "@/components/admin/settings-forms";
import { Badge, DemoTag, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SettingsView />
    </Suspense>
  );
}

async function SettingsView() {
  await requireAdmin();
  const db = await getAdminData();
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title={<span className="flex items-center gap-2">Services <DemoTag>All demo</DemoTag></span>}>
            <ul className="space-y-3">
              {[...db.services].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => (
                <li key={s.id}>
                  <details className="rounded-[var(--radius)] border border-line">
                    <summary className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                      <span className="font-semibold">{s.name}</span>
                      <span className="tabular text-sm text-ink-2">{s.priceKobo === null ? "Price TBC" : formatNaira(s.priceKobo)} · {s.durationMinutes ? formatDuration(s.durationMinutes) : "default duration"}</span>
                      <span className="ml-auto flex gap-1.5">
                        {s.status === "demo" && <DemoTag>Demo</DemoTag>}
                        <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Bookable" : "Hidden"}</Badge>
                      </span>
                    </summary>
                    <div className="border-t border-line p-4"><ServiceForm service={s} /></div>
                  </details>
                </li>
              ))}
            </ul>
            <details className="mt-4 rounded-[var(--radius)] border border-dashed border-line-strong">
              <summary className="min-h-12 px-4 py-3 font-semibold">+ Add a service</summary>
              <div className="border-t border-line p-4"><ServiceForm /></div>
            </details>
            <p className="mt-3 text-xs text-ink-3">Editing a service never changes past bookings — each booking keeps a snapshot of name, price and duration.</p>
          </Panel>

          <Panel title={<span className="flex items-center gap-2">Availability &amp; deposit <DemoTag>Demo values</DemoTag></span>}>
            <AvailabilityForm settings={db.settings} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={`Needs owner confirmation (${done}/${db.settings.checklist.length})`}>
            <OwnerChecklist items={db.settings.checklist} />
            <p className="mt-3 text-xs text-ink-3">Ticking an item only tracks progress here. Update the matching config before launch.</p>
          </Panel>
          <Panel title="Business facts on the public site">
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
      </div>
    </>
  );
}
