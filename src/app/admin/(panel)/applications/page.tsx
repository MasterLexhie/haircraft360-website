import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GraduationCap, Search, Settings2 } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { applicationCounts, listApplications, listPrograms } from "@/server/academy";
import { requestNow } from "@/server/queries";
import { APPLICATION_STATUSES, ageOn, applicationStatusLabel, type ApplicationStatus } from "@/domain/academy";
import { formatPhone } from "@/domain/phone";
import { pageHref, paginate } from "@/domain/paginate";
import { formatDate, lagosDateKey } from "@/lib/time";
import { PageHeader } from "@/components/admin/bits";
import { Pagination } from "@/components/admin/pagination";
import { Badge, EmptyState, Skeleton, buttonClass, cx, inputClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Locs Mastery applications" };

type Search = { status?: string; program?: string; q?: string; page?: string };
const PER_PAGE = 20;

export default function ApplicationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Applications searchParams={searchParams} />
    </Suspense>
  );
}

async function Applications({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const [params, nowMs, programs, counts] = await Promise.all([searchParams, requestNow(), listPrograms(), applicationCounts()]);
  const status = (APPLICATION_STATUSES as string[]).includes(params.status ?? "") ? (params.status as ApplicationStatus) : undefined;
  const programId = programs.some((p) => p.id === params.program) ? params.program : undefined;
  const q = params.q?.trim().slice(0, 80) || undefined;
  const rows = await listApplications({ status, programId, q });
  const paged = paginate(rows, params.page, PER_PAGE);
  const today = lagosDateKey(nowMs);
  const base = { program: programId, q };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const tabs: { key: ApplicationStatus | undefined; label: string; count: number }[] = [
    { key: undefined, label: "All", count: total },
    ...APPLICATION_STATUSES.map((s) => ({ key: s, label: applicationStatusLabel[s].label, count: counts[s] })),
  ];

  return (
    <>
      <PageHeader
        title="Locs Mastery"
        description="Applications to the training programs. Contact each new applicant, then record what you decide."
        actions={
          <Link href="/admin/settings?tab=programs" className={buttonClass("secondary", "md")}>
            <Settings2 aria-hidden className="size-4" /> Programs
          </Link>
        }
      />

      <nav aria-label="Filter by status" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {tabs.map((t) => {
            const active = t.key === status;
            return (
              <li key={t.label}>
                <Link
                  href={pageHref("/admin/applications", { ...base, status: t.key }, 1)}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
                    active ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                  )}
                >
                  {t.label} <span className={cx("tabular text-xs", active ? "text-on-accent/80" : "text-ink-3")}>{t.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/admin/applications" className="mb-6 grid gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">Search</span>
          <span className="relative block">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input name="q" defaultValue={q} placeholder="Name, phone, email or reference" className={cx(inputClass, "pl-9 text-sm")} />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">Program</span>
          <select name="program" defaultValue={programId ?? ""} className={cx(inputClass, "text-sm")}>
            <option value="">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass("night", "md")}>Show</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<GraduationCap aria-hidden className="size-6" />} title={total === 0 ? "No applications yet" : "No applications match"}>
          {total === 0 ? "Applications sent from the Locs Mastery page appear here." : "Try another status, program or search."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius)] border border-line bg-surface">
          {paged.items.map((a) => {
            const s = applicationStatusLabel[a.status];
            return (
              <li key={a.id}>
                <Link href={`/admin/applications/${a.id}`} className="flex flex-col gap-2 p-4 hover:bg-sand/40 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{a.fullName}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-2">{a.programName}</span>
                    <span className="block text-sm text-ink-3">
                      {formatPhone(a.phone)} · {a.city}, {a.state} · {ageOn(a.dateOfBirth, today)} years old
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-ink-3 sm:text-right">
                    <span className="block tabular">{a.reference}</span>
                    Applied {formatDate(Date.parse(a.createdAt))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 0 && <Pagination label="Application pages" noun="applications" {...paged} hrefFor={(n) => pageHref("/admin/applications", { ...base, status }, n)} />}
    </>
  );
}
