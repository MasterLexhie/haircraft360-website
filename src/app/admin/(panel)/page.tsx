import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CalendarDays, Hourglass, Wallet } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { requestNow } from "@/server/queries";
import { getDashboard, type AdminBookingRow, type MonthBooking } from "@/server/admin-queries";
import { getAttention } from "@/server/attention";
import { dailyTotals } from "@/server/finances";
import { balanceDue } from "@/domain/pricing";
import { changeLabel, monthToDateComparison } from "@/domain/periods";
import { formatNaira } from "@/lib/money";
import { addDays, formatDateTime, formatMonthYear, formatShortDate, formatTime, lagosDateKey } from "@/lib/time";
import { BookingStatusBadge, PageHeader, Panel, PaymentStateBadge, VisitBadge } from "@/components/admin/bits";
import { AttentionBox } from "@/components/admin/attention";
import { EmptyState, Skeleton, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Admin dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

/** Bookings that count as real appointments for the month's figures. */

async function Dashboard() {
  await requireAdmin();
  const nowMs = await requestNow();
  const today = lagosDateKey(nowMs);
  const span = monthToDateComparison(today);
  const [dash, attention, thisMonth, lastMonth] = await Promise.all([
    getDashboard(nowMs, today),
    getAttention(nowMs),
    dailyTotals(span.fromKey, span.toKey),
    dailyTotals(span.lastFromKey, span.lastToKey),
  ]);
  const weekEnd = addDays(today, 7);
  const { todays, nextUp, unpaid } = dash;
  const unpaidSum = unpaid.reduce((s, r) => s + balanceDue(r.booking, r.payments), 0);

  // This calendar month's appointments, for popular services and new versus returning.
  const popular = topServices(dash.month);
  const mix = newVersusReturning(dash.month);
  const monthName = formatMonthYear(today);

  const money = [
    { label: "Revenue", now: thisMonth.revenueKobo, before: lastMonth.revenueKobo, goodWhenUp: true },
    { label: "Expenses", now: thisMonth.expensesKobo, before: lastMonth.expensesKobo, goodWhenUp: false },
    { label: "Net", now: thisMonth.netKobo, before: lastMonth.netKobo, goodWhenUp: true },
  ];
  const stats = [
    { label: "Today", value: todays.length, sub: todays.length === 1 ? "appointment" : "appointments", icon: CalendarDays, href: `/admin/bookings?from=${today}&to=${today}` },
    { label: "Next 7 days", value: dash.upcomingCount, sub: "confirmed", icon: CalendarClock, href: `/admin/bookings?status=confirmed&from=${today}&to=${weekEnd}` },
    { label: "Awaiting deposit", value: dash.awaitingCount, sub: "times on hold", icon: Hourglass, href: "/admin/bookings?status=pending_payment" },
    { label: "Balances due", value: unpaid.length, sub: unpaidSum ? `${formatNaira(unpaidSum)} to collect` : "nothing to collect", icon: Wallet, href: "/admin/bookings?payment=balance_due" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={`${formatDateTime(nowMs)} (Ibadan time)`} />

      <AttentionBox attention={attention} />

      <section aria-labelledby="month-title" className="mb-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="month-title" className="type-caps text-[0.78rem] text-accent-text">{monthName} so far</h2>
          <Link href="/admin/finances" className="text-sm font-semibold underline">Finances</Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {money.map((m, i) => {
            const change = changeLabel(m.now, m.before);
            const up = m.now > m.before;
            const good = change && change !== "same" ? up === m.goodWhenUp : null;
            return (
              <li key={m.label} className={i === 2 ? "on-night rounded-[var(--radius)] bg-accent p-4 text-on-accent" : "rounded-[var(--radius)] border border-line bg-surface p-4"}>
                <span className={cx("block text-xs font-semibold uppercase tracking-[0.1em]", i === 2 ? "text-on-night-2" : "text-ink-3")}>{m.label}</span>
                <span className={cx("mt-2 block tabular font-display text-3xl", i === 2 ? "text-on-accent" : "text-accent-text")}>{formatNaira(m.now)}</span>
                <span className={cx("mt-1 block text-xs", i === 2 ? "text-on-night-2" : "text-ink-2")}>
                  {formatNaira(m.before)} by this date last month
                  {change && (
                    <>
                      {" · "}
                      <span className={cx("font-semibold", i !== 2 && good === true && "text-success", i !== 2 && good === false && "text-danger")}>{change}</span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Today's schedule">
            {todays.length === 0 ? <EmptyState title="No appointments today">Upcoming confirmed bookings are listed below.</EmptyState> : <ScheduleList rows={todays} />}
          </Panel>
          <Panel title="Coming up" action={<Link href="/admin/bookings?status=confirmed" className="text-sm font-semibold underline">All</Link>}>
            {nextUp.length === 0 ? <EmptyState title="Nothing upcoming yet">New online bookings appear here once their deposit is paid.</EmptyState> : <ScheduleList rows={nextUp} showDate />}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Balances to collect">
            {unpaid.length === 0 ? (
              <p className="text-sm text-ink-3">Every completed appointment is paid in full.</p>
            ) : (
              <ul className="divide-y divide-line">
                {unpaid.map((r) => (
                  <li key={r.booking.id}>
                    <Link href={`/admin/bookings/${r.booking.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-sand/50">
                      <span className="min-w-0">
                        <span className="font-medium">{r.booking.contactName}</span> <span className="text-ink-3">· {r.booking.reference}</span>
                      </span>
                      <span className="tabular shrink-0 font-semibold text-danger">{formatNaira(balanceDue(r.booking, r.payments))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Popular services, ${monthName}`}>
            {popular.length === 0 ? (
              <p className="text-sm text-ink-3">No appointments this month yet.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {popular.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate"><span className="tabular text-ink-3">{i + 1}.</span> {p.name}</span>
                    <span className="tabular shrink-0 text-ink-2">{p.count} booked</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title={`Customers, ${monthName}`}>
            {mix.new + mix.returning === 0 ? (
              <p className="text-sm text-ink-3">No appointments this month yet.</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-ink-3">New</dt>
                    <dd className="tabular font-display text-2xl text-accent-text">{mix.new}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Returning</dt>
                    <dd className="tabular font-display text-2xl text-accent-text">{mix.returning}</dd>
                  </div>
                </dl>
                <div aria-hidden className="mt-3 flex h-2 overflow-hidden rounded-full bg-sand">
                  <span className="bg-info" style={{ width: `${(mix.new / (mix.new + mix.returning)) * 100}%` }} />
                  <span className="bg-accent" style={{ width: `${(mix.returning / (mix.new + mix.returning)) * 100}%` }} />
                </div>
                <p className="mt-2 text-xs text-ink-3">Returning means they had a completed visit before this month&apos;s booking.</p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** Main services booked this month, most booked first. */
function topServices(rows: MonthBooking[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const name of r.mainServices) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);
}

/** Each customer counted once, by their first appointment this month. */
function newVersusReturning(rows: MonthBooking[]): { new: number; returning: number } {
  const first = new Map<string, MonthBooking>();
  for (const r of rows) if (!first.has(r.customerId)) first.set(r.customerId, r);
  let returning = 0;
  for (const r of first.values()) if (r.visit.returning) returning++;
  return { new: first.size - returning, returning };
}

function ScheduleList({ rows, showDate }: { rows: AdminBookingRow[]; showDate?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map(({ booking, payments, visit }) => (
        <li key={booking.id}>
          <Link href={`/admin/bookings/${booking.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-sand/50">
            <span className="w-24 shrink-0 tabular text-sm font-semibold">
              {showDate && <span className="block text-xs font-normal text-ink-3">{formatShortDate(booking.startAt)}</span>}
              {formatTime(booking.startAt)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{booking.contactName}</span>
              <span className="block truncate text-xs text-ink-3">{booking.items.filter((l) => l.kind !== "extra").map((l) => l.name).join(", ")}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              <BookingStatusBadge status={booking.status} />
              <PaymentStateBadge booking={booking} payments={payments} />
              <VisitBadge visit={visit} />
            </span>
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
      <Skeleton className="h-24" />
      <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}
