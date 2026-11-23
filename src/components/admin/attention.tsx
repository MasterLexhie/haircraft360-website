import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, ArrowRight, ChevronDown, CalendarClock, CheckCircle2, Clock, GraduationCap, MailX, MessageCircle, Wrench } from "lucide-react";
import type { Attention, AttentionBooking } from "@/server/attention";
import type { ManualMessage } from "@/server/whatsapp-messages";
import { formatDateTime, formatShortDate, formatTime } from "@/lib/time";
import { WhatsappSend } from "@/components/admin/whatsapp-send";
import { attentionCount } from "@/server/attention";
import { Badge, cx } from "@/components/ui/primitives";

/**
 * The dashboard's "Needs your attention" box (BUILD_SPEC 6.7). Each row says what happened in
 * plain words and offers the one thing the owner can do about it. Nothing to do: "All messages
 * delivered".
 */
export function AttentionBox({ attention: a, className }: { attention: Attention; className?: string }) {
  const count = attentionCount(a);
  return (
    <section aria-labelledby="attention-title" className={cx("@container rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 id="attention-title" className="text-sm font-semibold text-ink">Needs your attention</h2>
        {count > 0 && <Badge tone="warning">{count}</Badge>}
      </div>
      {count === 0 ? (
        <p role="status" className="flex items-center gap-2 px-4 py-4 text-sm text-success sm:px-5">
          <CheckCircle2 aria-hidden className="size-5" /> All messages delivered. Nothing needs you right now.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {a.scheduler.stopped && (
            <Row tone="danger" icon={<Wrench />} title="Reminders aren't running" action={<DeveloperLink href={a.scheduler.developerUrl} />}>
              {a.scheduler.lastRunAt ? `The reminder service last ran ${formatDateTime(a.scheduler.lastRunAt)}.` : "The reminder service hasn't run yet."} Emails and reminders wait until it is fixed.
            </Row>
          )}
          {a.newTimeNeeded.map((b) => (
            <Row
              key={b.id}
              tone="danger"
              icon={<CalendarClock />}
              title="Payment received, time needs changing"
              action={<ActionLink href={`/admin/bookings/${b.id}#move`}>Move the booking</ActionLink>}
            >
              <BookingLine booking={b} />. The deposit arrived after this time was taken. Agree a new time with the customer.
            </Row>
          ))}
          {a.unreachable.map((m) => (
            <Row
              key={m.id}
              tone="warning"
              icon={<MailX />}
              title="Couldn't reach this customer by email"
              action={
                <div className="flex flex-col items-start gap-2">
                  <WhatsappSend message={m} />
                  <Link href={`/admin/bookings/${m.bookingId}#messages`} className="inline-flex min-h-10 items-center text-sm font-semibold underline">
                    Fix the email
                  </Link>
                </div>
              }
            >
              <MessageLine message={m} />
            </Row>
          ))}
          {a.delayed.length > 0 && (
            <Row tone="warning" icon={<Clock />} title="Some reminders were delayed">
              The daily email limit was reached. These go out by email after it resets, or send them on WhatsApp now.
              <ul className="mt-3 space-y-3">
                {a.delayed.map((m) => (
                  <li key={m.id} className="flex flex-col gap-2 rounded-[var(--radius)] border border-line p-3 @lg:flex-row @lg:items-center @lg:justify-between">
                    <span className="text-sm text-ink"><MessageLine message={m} /></span>
                    <WhatsappSend message={m} />
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {a.whatsappDue > 0 && (
            <Row
              tone="info"
              icon={<MessageCircle />}
              title={`${a.whatsappDue} WhatsApp message${a.whatsappDue === 1 ? "" : "s"} to send today`}
              action={<ActionLink href="/admin/reminders">Open Reminders due</ActionLink>}
            >
              For customers without an email address.
            </Row>
          )}
          {a.newApplications > 0 && (
            <Row
              tone="info"
              icon={<GraduationCap />}
              title={`${a.newApplications} new Locs Mastery application${a.newApplications === 1 ? "" : "s"}`}
              action={<ActionLink href="/admin/applications?status=new">Review them</ActionLink>}
            >
              Get in touch with each applicant, then mark them contacted.
            </Row>
          )}
          {a.toComplete.length > 0 && (
            <Row
              tone="info"
              icon={<CheckCircle2 />}
              title={`${a.toComplete.length} past appointment${a.toComplete.length === 1 ? "" : "s"} to mark completed`}
              action={<ActionLink href={`/admin/bookings/${a.toComplete[0]!.id}#complete`}>{a.toComplete.length === 1 ? "Complete it" : "Start with the oldest"}</ActionLink>}
            >
              Add anything done on the day and mark each one completed or no-show, so balances can be collected.
              <ul className="mt-2 space-y-1">
                {a.toComplete.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}#complete`} className="underline">
                      <BookingLine booking={b} />
                    </Link>
                  </li>
                ))}
                {a.toComplete.length > 5 && <li className="text-ink-3">and {a.toComplete.length - 5} more</li>}
              </ul>
            </Row>
          )}
          {a.systemErrors.problems.length > 0 && (
            <Row tone="danger" icon={<AlertCircle />} title="Something went wrong behind the scenes" action={<DeveloperLink href={a.systemErrors.developerUrl} />}>
              <ul className="space-y-1">
                {a.systemErrors.problems.map((p) => (
                  <li key={p.reference}>
                    {p.summary} ({formatDateTime(p.at)}). Reference <span className="font-mono text-xs">{p.reference}</span>
                  </li>
                ))}
              </ul>
            </Row>
          )}
        </ul>
      )}
    </section>
  );
}

const toneIcon = { danger: "text-danger", warning: "text-warning", info: "text-info" } as const;

/**
 * One item, folded like an FAQ: the title shows, and opening it gives the detail and the action.
 * A native <details>, so it works without JavaScript and with the keyboard.
 */
function Row({ tone, icon, title, action, children }: { tone: keyof typeof toneIcon; icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-sand/50 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span aria-hidden className={cx("shrink-0 [&>svg]:size-5", toneIcon[tone])}>{icon}</span>
          <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{title}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 px-4 pb-4 pl-12 text-sm text-ink-2 sm:px-5 sm:pl-[3.25rem]">
          <div>{children}</div>
          {action && <div>{action}</div>}
        </div>
      </details>
    </li>
  );
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold underline">
      {children} <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

function DeveloperLink({ href }: { href: string | null }) {
  if (!href) return <p className="text-sm text-ink-2">Contact your developer.</p>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold underline">
      <MessageCircle aria-hidden className="size-4" /> Contact your developer
    </a>
  );
}

function BookingLine({ booking: b }: { booking: AttentionBooking }) {
  return (
    <>
      {b.name}, {formatShortDate(b.startAt)} at {formatTime(b.startAt)} · {b.reference}
    </>
  );
}

function MessageLine({ message: m }: { message: ManualMessage }) {
  return (
    <>
      {m.type === "confirmation" ? "Confirmation" : "Reminder"} for <Link href={`/admin/bookings/${m.bookingId}`} className="font-medium text-ink underline">{m.name}</Link>, {formatShortDate(m.startAt)} at {formatTime(m.startAt)} · {m.phone}
    </>
  );
}
