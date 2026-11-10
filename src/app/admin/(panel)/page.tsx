import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle, ArrowRight, CalendarClock, CalendarDays, Hourglass, Wallet } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getAdminData, joinBooking, requestNow } from "@/server/queries";
import { balanceDue } from "@/domain/pricing";
import { formatNaira } from "@/lib/money";
import { addDays, formatDateTime, formatShortDate, formatTime, lagosDateKey } from "@/lib/time";
import { BookingStatusBadge, PageHeader, Panel, PaymentStateBadge } from "@/components/admin/bits";
import { EmptyState, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Admin dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await requireAdmin();
  const db = await getAdminData();
  const nowMs = await requestNow();
  const today = lagosDateKey(nowMs);
  const weekEnd = addDays(today, 7);
  const rows = db.bookings.map((b) => joinBooking(db, b));

  const todays = rows.filter((r) => ["confirmed", "completed"].includes(r.booking.status) && lagosDateKey(r.booking.startAt) === today).sort((a, b) => a.booking.startAt.localeCompare(b.booking.startAt));
  const upcoming = rows.filter((r) => r.booking.status === "confirmed" && Date.parse(r.booking.startAt) > nowMs && lagosDateKey(r.booking.startAt) <= weekEnd);
  const awaiting = rows.filter((r) => r.booking.status === "awaiting_deposit");
  const unpaid = rows.filter((r) => r.booking.status === "completed" && (balanceDue(r.booking, r.payments) ?? 0) > 0);
  const unpaidSum = unpaid.reduce((s, r) => s + (balanceDue(r.booking, r.payments) ?? 0), 0);
  const toComplete = rows.filter((r) => r.booking.status === "confirmed" && Date.parse(r.booking.endAt) < nowMs);
  const nextUp = rows.filter((r) => r.booking.status === "confirmed" && Date.parse(r.booking.startAt) > nowMs).sort((a, b) => a.booking.startAt.localeCompare(b.booking.startAt)).slice(0, 5);
  const activity = [...db.audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  const stats = [
    { label: "Today", value: todays.length, sub: "appointments", icon: CalendarDays, href: `/admin/bookings?from=${today}&to=${today}` },
    { label: "Next 7 days", value: upcoming.length, sub: "confirmed", icon: CalendarClock, href: `/admin/bookings?status=confirmed&from=${today}&to=${weekEnd}` },
    { label: "Awaiting deposit", value: awaiting.length, sub: "slots on hold", icon: Hourglass, href: "/admin/bookings?status=awaiting_deposit" },
    { label: "Balances due", value: unpaid.length, sub: unpaidSum ? `${formatNaira(unpaidSum)} outstanding` : "nothing outstanding", icon: Wallet, href: "/admin/bookings?payment=balance_due" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={`Counts below come from the demo records · ${formatDateTime(nowMs)} (Ibadan time)`} />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="flex h-full flex-col rounded-[var(--radius)] border border-line bg-surface p-4 transition-colors hover:border-ink">
              <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.1em] text-ink-3">
                {s.label} <s.icon aria-hidden className="size-4" />
              </span>
              <span className="mt-2 tabular font-display text-3xl text-accent-text">{s.value}</span>
              <span className="text-xs text-ink-2">{s.sub}</span>
            </Link>
          </li>
        ))}
      </ul>

      {toComplete.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-[var(--radius)] border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-ink">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            {toComplete.length} past appointment{toComplete.length > 1 ? "s need" : " needs"} the actual services and total recorded.
          </p>
          <Link href={`/admin/bookings/${toComplete[0].booking.id}#complete`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold underline">
            Record completion <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Today's schedule">
            {todays.length === 0 ? (
              <EmptyState title="No appointments today">Upcoming confirmed bookings are listed below.</EmptyState>
            ) : (
              <ScheduleList rows={todays} />
            )}
          </Panel>
          <Panel title="Coming up" action={<Link href="/admin/bookings?status=confirmed" className="text-sm font-semibold underline">All</Link>}>
            {nextUp.length === 0 ? <EmptyState title="Nothing upcoming yet">New online bookings appear here once their deposit is paid.</EmptyState> : <ScheduleList rows={nextUp} showDate />}
          </Panel>
          {unpaid.length > 0 && (
            <Panel title="Balances to collect">
              <ul className="divide-y divide-line">
                {unpaid.map((r) => (
                  <li key={r.booking.id}>
                    <Link href={`/admin/bookings/${r.booking.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-sand/50">
                      <span><span className="font-medium">{r.customer.name}</span> <span className="text-ink-3">· {r.booking.reference}</span></span>
                      <span className="tabular font-semibold text-danger">{formatNaira(balanceDue(r.booking, r.payments) ?? 0)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <Panel title="Recent activity">
          <ol className="space-y-3">
            {activity.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="text-ink">{e.summary}</p>
                <p className="text-xs text-ink-3">{formatDateTime(e.at)} · {e.actor}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}

function ScheduleList({ rows, showDate }: { rows: ReturnType<typeof joinBooking>[]; showDate?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map(({ booking, customer, payments }) => (
        <li key={booking.id}>
          <Link href={`/admin/bookings/${booking.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-sand/50">
            <span className="w-24 shrink-0 tabular text-sm font-semibold">
              {showDate && <span className="block text-xs font-normal text-ink-3">{formatShortDate(booking.startAt)}</span>}
              {formatTime(booking.startAt)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{customer.name}</span>
              <span className="block truncate text-xs text-ink-3">{booking.lines.filter((l) => l.kind === "booked").map((l) => l.name).join(", ")}</span>
            </span>
            <span className="flex gap-1.5"><BookingStatusBadge status={booking.status} /><PaymentStateBadge booking={booking} payments={payments} /></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}
