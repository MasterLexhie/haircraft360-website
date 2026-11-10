import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, CreditCard, Lock, Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getAdminData } from "@/server/queries";
import { balanceDue, paidKobo } from "@/domain/pricing";
import { paymentPurposeLabel, paymentStateLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";
import { BookingStatusBadge, PageHeader, Panel } from "@/components/admin/bits";
import { PrivateNoteForm } from "@/components/admin/booking-forms";
import { Badge, DemoTag, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Customer" };

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CustomerView params={params} />
    </Suspense>
  );
}

async function CustomerView({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const [{ id }, db] = await Promise.all([params, getAdminData()]);
  const c = db.customers.find((x) => x.id === id);
  if (!c) notFound();
  const bookings = db.bookings.filter((b) => b.customerId === c.id);
  const payments = db.payments.filter((p) => p.customerId === c.id);
  const outstanding = bookings.reduce((s, b) => s + (balanceDue(b, payments.filter((p) => p.bookingId === b.id)) ?? 0), 0);
  const refOf = (bookingId: string) => bookings.find((b) => b.id === bookingId)?.reference ?? "";

  // One chronological timeline of bookings and payments (oldest first).
  const timeline = [
    ...bookings.map((b) => ({ kind: "booking" as const, at: b.startAt, b })),
    ...payments.map((p) => ({ kind: "payment" as const, at: p.resolvedAt ?? p.createdAt, p })),
  ].sort((x, y) => x.at.localeCompare(y.at));

  return (
    <>
      <PageHeader back={{ href: "/admin/customers", label: "All customers" }} title={<span className="flex flex-wrap items-center gap-2">{c.name} {c.isDemo && <DemoTag>Demo record</DemoTag>}</span>} description={`Customer since ${formatDate(c.createdAt)}`} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Bookings and payments (oldest first)">
          <ol className="space-y-3">
            {timeline.map((t) =>
              t.kind === "booking" ? (
                <li key={`b-${t.b.id}`}>
                  <Link href={`/admin/bookings/${t.b.id}`} className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-line p-3 hover:border-ink">
                    <CalendarDays aria-hidden className="size-5 shrink-0 text-accent-text" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{formatDate(t.b.startAt)}, {formatTime(t.b.startAt)} · {t.b.reference}</span>
                      <span className="block text-sm text-ink-3">{t.b.lines.filter((l) => l.kind === "booked").map((l) => l.name).join(", ")}</span>
                      <span className="block text-sm tabular text-ink-2">
                        Est. {formatNaira(t.b.estimatedTotalKobo)}{t.b.actualTotalKobo !== null && ` · actual ${formatNaira(t.b.actualTotalKobo)}`}
                      </span>
                    </span>
                    <BookingStatusBadge status={t.b.status} />
                  </Link>
                </li>
              ) : (
                <li key={`p-${t.p.id}`} className="flex flex-wrap items-center gap-3 pl-3 text-sm">
                  <CreditCard aria-hidden className="size-4 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 text-ink-2">
                    {paymentPurposeLabel[t.p.purpose]} for {refOf(t.p.bookingId)} · {formatDateTime(t.at)}
                    {t.p.source === "manual_entry" && ` · manual (${t.p.method})`}
                  </span>
                  <span className={`tabular font-semibold ${t.p.state === "success" ? "" : "text-ink-3 line-through"}`}>{formatNaira(t.p.amountKobo)}</span>
                  <Badge tone={paymentStateLabel[t.p.state].tone}>{paymentStateLabel[t.p.state].label}</Badge>
                </li>
              ),
            )}
          </ol>
        </Panel>

        <div className="space-y-6">
          <Panel title="Contact">
            <ul className="space-y-2 text-sm">
              {c.phone ? <li className="flex items-center gap-2"><Phone aria-hidden className="size-4 text-ink-3" /><a className="underline" href={`tel:${c.phone}`}>{c.phone}</a></li> : <li className="text-ink-3">No phone</li>}
              {c.email ? <li className="flex items-center gap-2"><Mail aria-hidden className="size-4 text-ink-3" /><a className="break-all underline" href={`mailto:${c.email}`}>{c.email}</a></li> : <li className="text-ink-3">No email</li>}
            </ul>
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
              <div><dt className="text-xs text-ink-3">Bookings</dt><dd className="tabular font-semibold">{bookings.length}</dd></div>
              <div><dt className="text-xs text-ink-3">Paid</dt><dd className="tabular font-semibold">{formatNaira(paidKobo(payments))}</dd></div>
              <div><dt className="text-xs text-ink-3">Owes</dt><dd className={`tabular font-semibold ${outstanding ? "text-danger" : ""}`}>{formatNaira(outstanding)}</dd></div>
            </dl>
          </Panel>
          <Panel title={<span className="flex items-center gap-1.5"><Lock aria-hidden className="size-3.5" /> Private customer notes</span>}>
            <PrivateNoteForm kind="customer" id={c.id} defaultValue={c.privateNotes} />
          </Panel>
        </div>
      </div>
    </>
  );
}
