import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Lock, Mail, MessageCircle, Phone, MessageSquareText } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getMoveSlots, requestNow } from "@/server/queries";
import { bookingAudit, getAdminBooking } from "@/server/admin-queries";
import { bookingMessages, type BookingMessages } from "@/server/whatsapp-messages";
import { balanceDue, paidKobo } from "@/domain/pricing";
import { formatPhone } from "@/domain/phone";
import { bookingStatusLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatDateKey, formatDateTime, formatDuration, formatLongDate, formatTime, isValidDateKey, lagosDateKey } from "@/lib/time";
import { BookingStatusBadge, KeyValue, PageHeader, Panel, PaymentStateBadge, VisitBadge } from "@/components/admin/bits";
import { BalanceLink, BookingEmailForm, CompletionForm, ManualPaymentForm, MoveTimes, PrivateNoteForm, StatusActions } from "@/components/admin/booking-forms";
import { WhatsappSend } from "@/components/admin/whatsapp-send";
import { DetailTabs, TabSection } from "@/components/admin/detail-tabs";
import { PaymentHistory } from "@/components/booking/payment-history";
import { Alert, Badge, Button, Field, Skeleton, buttonClass, inputClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Booking detail" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ move?: string }> };

export default function BookingDetailPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <Detail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Detail({ params, searchParams }: Props) {
  await requireAdmin();
  const [{ id }, { move }, nowMs] = await Promise.all([params, searchParams, requestNow()]);
  const row = await getAdminBooking(id);
  if (!row) notFound();
  const { booking, customer, payments, visit } = row;
  const [messages, audit] = await Promise.all([bookingMessages(booking.id, nowMs), bookingAudit(booking.id)]);
  const paid = paidKobo(payments);
  const due = balanceDue(booking, payments);
  const minutes = (Date.parse(booking.endAt) - Date.parse(booking.startAt)) / 60_000;
  const isPast = Date.parse(booking.endAt) < nowMs;
  const started = Date.parse(booking.startAt) <= nowMs;
  // Completing (and adding items on the day) waits for the appointment to start.
  const canComplete = (booking.status === "confirmed" && started) || booking.status === "completed";
  const canMove = booking.status === "confirmed" || booking.status === "needs_attention";
  const today = lagosDateKey(nowMs);
  const bookingDay = lagosDateKey(booking.startAt);
  const moveDay = move && isValidDateKey(move) && move >= today ? move : bookingDay >= today ? bookingDay : today;
  const canCollect = due > 0 && booking.status !== "pending_payment" && booking.status !== "expired" && booking.status !== "cancelled";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/bookings", label: "All bookings" }}
        title={<span className="flex flex-wrap items-center gap-3">{booking.reference} <BookingStatusBadge status={booking.status} /> <PaymentStateBadge booking={booking} payments={payments} /> <VisitBadge visit={visit} /></span>}
        description={`${formatLongDate(booking.startAt)} · ${formatTime(booking.startAt)} – ${formatTime(booking.endAt)} (${formatDuration(minutes)})`}
        actions={<StatusActions bookingId={booking.id} status={booking.status} started={started} />}
        phoneActions={false}
      />

      <DetailTabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "payments", label: "Payments", count: payments.length },
          { id: "messages", label: "Messages", count: messages.messages.filter((m) => m.manual).length },
          { id: "activity", label: "Activity" },
        ]}
        collect={canCollect ? `Collect balance · ${formatNaira(due)}` : undefined}
      >
      <TabSection tab="overview">

      {booking.status === "pending_payment" && booking.holdExpiresAt && (
        <Alert tone="warning" className="mb-6" title={`Time held until ${formatTime(booking.holdExpiresAt)} while the customer pays the deposit`}>
          Not confirmed yet. If no deposit arrives in time, the time is released automatically.
        </Alert>
      )}
      {booking.status === "needs_attention" && (
        <Alert tone="danger" className="mb-6" title="Payment received, but the time needs changing">
          The deposit arrived after this time was taken. Contact the customer, agree a new time and{" "}
          <a href="#move" className="font-semibold underline">move the booking</a>. It is confirmed once moved.
        </Alert>
      )}
      {booking.status === "confirmed" && isPast && (
        <Alert tone="warning" className="mb-6" title="This appointment has passed">
          Add anything done on the day and mark it completed below, so the balance can be collected.
        </Alert>
      )}
        <MoneyStrip total={booking.totalKobo} paid={paid} due={due} />
      </TabSection>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <TabSection tab="overview">
          <Panel title="Services (prices as booked)">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">Item</th>
                    <th scope="col" className="pb-2 text-right font-medium">Time</th>
                    <th scope="col" className="pb-2 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {booking.items.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium">{l.kind === "add_on" && <span className="text-ink-3">+ </span>}{l.name}</span>
                        {l.kind === "extra" && <span className="ml-2 text-xs text-ink-3">added on the day</span>}
                        {l.note && <span className="block text-xs text-ink-3">{l.note}</span>}
                      </td>
                      <td className="py-2.5 text-right tabular">{l.durationMinutes ? formatDuration(l.durationMinutes) : "None"}</td>
                      <td className="py-2.5 text-right tabular">{formatNaira(l.priceKobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {booking.customerNote && <p className="mt-3 rounded-[var(--radius)] bg-sand/60 p-3 text-sm"><span className="font-semibold">Customer note:</span> {booking.customerNote}</p>}
          </Panel>
          </TabSection>

          <TabSection tab="payments" id="payments" className="scroll-mt-20">
          <Panel title="Money">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Stat label="Total" value={formatNaira(booking.totalKobo)} sub={`Deposit due was ${formatNaira(booking.depositDueKobo)}`} />
              <Stat label="Paid" value={formatNaira(paid)} />
              <Stat label="Balance due" value={formatNaira(due)} strong />
            </dl>
            {canCollect && (
              <div className="mt-5 border-t border-line pt-4">
                <BalanceLink bookingId={booking.id} />
              </div>
            )}
            <h3 className="mt-6 border-t border-line pt-4 text-xs font-semibold uppercase tracking-[0.1em] text-ink-3">Payment entries</h3>
            <PaymentHistory payments={payments} />
            <details className="mt-4 rounded-[var(--radius)] border border-line">
              <summary className="min-h-11 px-4 py-3 text-sm font-semibold">Record a manual payment</summary>
              <div className="border-t border-line p-4"><ManualPaymentForm bookingId={booking.id} awaitingDeposit={booking.status === "pending_payment"} /></div>
            </details>
          </Panel>
          </TabSection>

          {canMove && (
            <TabSection tab="overview" id="move" className="scroll-mt-20">
              <Panel title="Move to another time">
                {/* A soft navigation that keeps the scroll position, so the new times appear in place. */}
                <Form action={`/admin/bookings/${booking.id}`} scroll={false} replace className="flex flex-wrap items-end gap-3">
                  <Field id="move-day" label="Day">
                    <input id="move-day" name="move" type="date" min={today} defaultValue={moveDay} className={inputClass} />
                  </Field>
                  <Button type="submit" variant="secondary" size="sm">Show free times</Button>
                </Form>
                <div className="mt-4">
                  <Suspense fallback={<Skeleton className="h-24" />}>
                    <MoveOptions booking={booking} dateKey={moveDay} minutes={minutes} />
                  </Suspense>
                </div>
              </Panel>
            </TabSection>
          )}

          {canComplete && (
            <TabSection tab="overview" id="complete" className="scroll-mt-20">
              <Panel title={booking.status === "completed" ? "Add to this appointment" : "Complete this appointment"}>
                <CompletionForm booking={booking} paidKobo={paid} />
              </Panel>
            </TabSection>
          )}
        </div>

        <div className="space-y-6">
          <TabSection tab="overview">
          <Panel title="Customer" action={<Link href={`/admin/customers/${customer.id}`} className="text-sm font-semibold underline">History</Link>}>
            <p className="font-semibold">{customer.displayName}</p>
            {booking.contactName !== customer.displayName && <p className="text-xs text-ink-3">Booked as “{booking.contactName}”</p>}
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex items-center gap-2"><Phone aria-hidden className="size-4 text-ink-3" /><a className="underline" href={`tel:${booking.contactPhone}`}>{formatPhone(booking.contactPhone)}</a></li>
              {booking.contactEmail ? (
                <li className="flex items-center gap-2"><Mail aria-hidden className="size-4 text-ink-3" /><a className="break-all underline" href={`mailto:${booking.contactEmail}`}>{booking.contactEmail}</a></li>
              ) : (
                <li className="flex items-center gap-2 text-ink-3"><Mail aria-hidden className="size-4" />{booking.contactOnWhatsapp ? "No email: message on WhatsApp" : "No email and not on WhatsApp: text or call"}</li>
              )}
            </ul>
          </Panel>
          </TabSection>

          <TabSection tab="messages" id="messages" className="scroll-mt-20">
            <MessagesPanel bookingId={booking.id} contactEmail={booking.contactEmail} view={messages} />
          </TabSection>

          <TabSection tab="overview">
          <Panel title={<span className="flex items-center gap-1.5"><Lock aria-hidden className="size-3.5" /> Private booking note</span>}>
            <PrivateNoteForm kind="booking" id={booking.id} defaultValue={booking.privateNote} />
          </Panel>

          <Panel title="Details">
            <KeyValue
              items={[
                { label: "Created", value: formatDateTime(booking.createdAt) },
                { label: "Status meaning", value: bookingStatusLabel[booking.status].help },
                { label: "Completed", value: booking.completedAt ? formatDateTime(booking.completedAt) : "—" },
              ]}
            />
          </Panel>
          </TabSection>

          <TabSection tab="activity">
          <Panel title="Activity">
            <ol className="relative space-y-4 border-l border-line pl-4">
              {audit.map((e) => (
                <li key={e.id} className="text-sm">
                  <span aria-hidden className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-surface bg-ink-3" />
                  <p className="text-ink">{e.summary}</p>
                  <p className="text-xs text-ink-3">{formatDateTime(e.at)} · {e.actor}</p>
                </li>
              ))}
            </ol>
          </Panel>
          </TabSection>
        </div>
      </div>

      <TabSection tab="overview" className="mt-6 md:hidden">
        <StatusActions bookingId={booking.id} status={booking.status} started={started} />
      </TabSection>
      </DetailTabs>
    </>
  );
}

async function MoveOptions({ booking, dateKey, minutes }: { booking: { id: string; startAt: string; endAt: string }; dateKey: string; minutes: number }) {
  const { status, startTimes } = await getMoveSlots(booking, dateKey);
  if (status === "closed") return <p className="text-sm text-ink-3">The salon is closed on {formatDateKey(dateKey, { long: true })}. Choose another day.</p>;
  if (status === "beyond_horizon") return <p className="text-sm text-ink-3">That day is beyond the booking window set in Settings. Choose an earlier day.</p>;
  if (!startTimes.length) return <p className="text-sm text-ink-3">No free times for {formatDuration(minutes)} on {formatDateKey(dateKey, { long: true })}. Choose another day.</p>;
  return (
    <>
      <p className="mb-3 text-sm text-ink-2">{formatDateKey(dateKey, { long: true })}: times with room for {formatDuration(minutes)}.</p>
      <MoveTimes key={dateKey} bookingId={booking.id} startTimes={startTimes} />
    </>
  );
}

/** Confirmation and reminder in plain words, with WhatsApp and an email fix when they're needed (Spec 6.7). */
function MessagesPanel({ bookingId, contactEmail, view }: { bookingId: string; contactEmail: string | null; view: BookingMessages }) {
  const canFix = view.whatsapp !== null && (!contactEmail || view.messages.some((m) => m.status.fixEmail));
  return (
    <Panel title="Messages">
      {view.messages.length === 0 ? (
        <p className="text-sm text-ink-3">No confirmation or reminder messages for this booking.</p>
      ) : (
        <ul className="space-y-3">
          {view.messages.map((m) => (
            <li key={m.id} className="space-y-2">
              <Badge tone={m.status.tone}>{m.status.label}</Badge>
              {m.sentAt && m.status.tone === "success" && <p className="text-xs text-ink-3">{formatDateTime(m.sentAt)}</p>}
              {m.manual && <WhatsappSend message={m.manual} />}
            </li>
          ))}
        </ul>
      )}
      {view.whatsapp && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-xs text-ink-3">
            {view.whatsapp.via === "whatsapp"
              ? "Send again on WhatsApp, in your wording from Settings:"
              : "Not on WhatsApp, the customer said. Send again by text message, in your wording from Settings, or call:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {(["confirmation", "reminder"] as const).map((k) => {
              const Icon = view.whatsapp!.via === "whatsapp" ? MessageCircle : MessageSquareText;
              const newTab = view.whatsapp!.via === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {};
              return (
                <a key={k} href={view.whatsapp![k]} {...newTab} className={buttonClass("secondary", "sm")}>
                  <Icon aria-hidden className="size-4" /> {k === "confirmation" ? "Confirmation" : "Reminder"}
                </a>
              );
            })}
            {view.whatsapp.via === "sms" && (
              <a href={view.whatsapp.telUrl} className={buttonClass("secondary", "sm")}>
                <Phone aria-hidden className="size-4" /> Call
              </a>
            )}
          </div>
        </div>
      )}
      {canFix && (
        <details className="mt-4 rounded-[var(--radius)] border border-line" open={view.messages.some((m) => m.status.fixEmail && m.status.tone === "danger")}>
          <summary className="min-h-11 px-4 py-3 text-sm font-semibold">{contactEmail ? "Fix the email" : "Add an email"}</summary>
          <div className="border-t border-line p-4">
            <BookingEmailForm bookingId={bookingId} current={contactEmail} />
          </div>
        </details>
      )}
    </Panel>
  );
}

function Stat({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`mt-0.5 tabular ${strong ? "text-xl font-semibold" : "font-semibold"}`}>{value}</dd>
      {sub && <dd className="text-xs text-ink-3">{sub}</dd>}
    </div>
  );
}

/** Phone overview: the three money numbers at a glance; the Payments tab has the detail. */
function MoneyStrip({ total, paid, due }: { total: number; paid: number; due: number }) {
  return (
    <dl className="mb-4 grid grid-cols-3 gap-2 rounded-[var(--radius)] bg-surface p-3.5 shadow-[var(--shadow-admin-card)] md:hidden">
      {[
        { label: "Total", value: total, tone: "text-ink" },
        { label: "Paid", value: paid, tone: "text-ink" },
        { label: "Balance due", value: due, tone: due > 0 ? "text-warning" : "text-ink" },
      ].map((m) => (
        <div key={m.label}>
          <dt className="text-[0.7rem] font-semibold text-ink-3">{m.label}</dt>
          <dd className={`mt-0.5 font-display text-xl tabular ${m.tone}`}>{formatNaira(m.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
