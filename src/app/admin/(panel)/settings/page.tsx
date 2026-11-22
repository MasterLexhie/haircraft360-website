import type { Metadata } from "next";
import Link from "next/link";
import { CalendarOff, Clock, GraduationCap, MessageSquareText, Receipt, Scissors, Store } from "lucide-react";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { getUpcomingBlocks, requestNow } from "@/server/queries";
import { getAdminSettings } from "@/server/admin-queries";
import { BlocksManager } from "@/components/admin/blocks-manager";
import { lagosDateKey } from "@/lib/time";
import { PageHeader } from "@/components/admin/bits";
import { AvailabilityForm, ServicesManager } from "@/components/admin/settings-forms";
import { ExpenseCategoriesManager, MessageTemplatesForm, SalonDetailsForm } from "@/components/admin/settings-more-forms";
import { listExpenseCategories } from "@/server/expenses";
import { listPrograms } from "@/server/academy";
import { ProgramsManager } from "@/components/admin/academy-forms";
import { DEFAULT_MESSAGE_TEMPLATES, salonAddress } from "@/domain/settings";
import { formatPhone } from "@/domain/phone";
import { formatNaira } from "@/lib/money";
import { addDays, formatDateKey } from "@/lib/time";
import { Skeleton, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Settings" };

/** `short`: the phone label, where the tabs scroll sideways. */
const TABS: { id: string; label: string; short?: string; icon: typeof Scissors }[] = [
  { id: "services", label: "Services", icon: Scissors },
  { id: "availability", label: "Availability & deposit", short: "Availability", icon: Clock },
  { id: "closures", label: "Closures", icon: CalendarOff },
  { id: "programs", label: "Locs Mastery programs", short: "Programs", icon: GraduationCap },
  { id: "messages", label: "Messages", icon: MessageSquareText },
  { id: "salon", label: "Salon details", icon: Store },
  { id: "categories", label: "Expense categories", short: "Expense types", icon: Receipt },
];
type TabId = "services" | "availability" | "closures" | "programs" | "messages" | "salon" | "categories";

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SettingsView searchParams={searchParams} />
    </Suspense>
  );
}

async function SettingsView({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const [db, sp, blocks, nowMs, categories] = await Promise.all([getAdminSettings(), searchParams, getUpcomingBlocks(), requestNow(), listExpenseCategories()]);
  const tab: TabId = TABS.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : "services";
  const programs = tab === "programs" ? await listPrograms() : [];
  return (
    <>
      <PageHeader phoneBack={{ href: "/admin/more", label: "More" }} title="Settings" description="Changes apply to new bookings only." />

      <div className="relative -mx-4 -mt-4 mb-6 border-b border-line bg-surface md:mx-0 md:mt-0 md:rounded-[var(--radius)] md:shadow-[var(--shadow-admin-card)]">
        <nav aria-label="Settings sections" className="overflow-x-auto px-3">
          <ul className="flex min-w-max gap-1 pr-8">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <li key={t.id}>
                  <Link
                    href={t.id === "services" ? "/admin/settings" : `/admin/settings?tab=${t.id}`}
                    aria-current={active ? "page" : undefined}
                    scroll={false}
                    className={cx(
                      "-mb-px flex min-h-12 items-center gap-2 whitespace-nowrap border-b-[3px] px-2.5 text-[0.8125rem] font-semibold transition-colors",
                      active ? "border-accent text-accent-text" : "border-transparent text-ink-3 hover:text-ink",
                    )}
                  >
                    <t.icon aria-hidden className="size-4" />
                    <span className="md:hidden">{t.short ?? t.label}</span>
                    <span className="max-md:hidden">{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent to-surface md:rounded-r-[var(--radius)]" />
      </div>

      {tab === "services" && <ServicesManager services={db.services} />}

      {tab === "closures" && <BlocksManager blocks={blocks} today={lagosDateKey(nowMs)} />}

      {tab === "availability" && (
        <AvailabilityForm settings={db.settings} />
      )}

      {tab === "messages" && (
        <MessageTemplatesForm
          templates={db.settings.messageTemplates}
          defaults={DEFAULT_MESSAGE_TEMPLATES}
          sample={{
            name: "Ada",
            service: db.services.find((x) => x.bookableAlone && x.active)?.name ?? "Retwist",
            date: formatDateKey(addDays(lagosDateKey(nowMs), 3), { long: true }),
            time: "10:00 am",
            total: formatNaira(2_500_000),
            deposit: formatNaira(750_000),
            balance: formatNaira(1_750_000),
            link: "https://…/booking/HC-ABC123",
            salon: db.settings.salonDetails.name,
            address: salonAddress(db.settings.salonDetails),
          }}
        />
      )}

      {tab === "salon" && (
        <SalonDetailsForm
          details={db.settings.salonDetails}
          phoneDisplay={{
            phone: db.settings.salonDetails.phoneE164 ? formatPhone(db.settings.salonDetails.phoneE164) : "",
            whatsapp: db.settings.salonDetails.whatsappE164 ? formatPhone(db.settings.salonDetails.whatsappE164) : "",
          }}
        />
      )}

      {tab === "categories" && <ExpenseCategoriesManager categories={categories} />}

      {tab === "programs" && <ProgramsManager programs={programs} />}

    </>
  );
}
