import Link from "next/link";
import {
  Banknote,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  CircleCheck,
  CircleX,
  CreditCard,
  NotebookPen,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import type { AuditEvent } from "@/domain/types";
import { addDays, formatDateKey, formatTime, lagosDateKey } from "@/lib/time";
import { cx } from "@/components/ui/primitives";

type Tone = "success" | "danger" | "accent" | "neutral";

const TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent-text",
  neutral: "bg-sand text-ink-2",
};

/** Turns a raw audit action into a short human title, icon and colour. */
function describe(action: string): { title: string; icon: LucideIcon; tone: Tone } {
  const [kind, a, b] = action.split(".");
  if (kind === "payment") {
    const what = a === "deposit" ? "Deposit" : a === "balance" ? "Balance" : "Payment";
    if (a === "manual") return { title: "Manual payment recorded", icon: Banknote, tone: "success" };
    if (b === "success") return { title: `${what} paid`, icon: Banknote, tone: "success" };
    if (b === "failed") return { title: `${what} payment failed`, icon: CircleX, tone: "danger" };
    if (b === "abandoned") return { title: `${what} checkout abandoned`, icon: CircleX, tone: "danger" };
    if (b === "initialized") return { title: `${what} checkout opened`, icon: CreditCard, tone: "neutral" };
    return { title: `${what} updated`, icon: CreditCard, tone: "neutral" };
  }
  if (kind === "booking") {
    switch (a) {
      case "created": return { title: "New booking", icon: CalendarPlus, tone: "accent" };
      case "confirmed": return { title: "Booking confirmed", icon: CalendarCheck, tone: "success" };
      case "completed": return { title: "Appointment completed", icon: CircleCheck, tone: "success" };
      case "completion_updated": return { title: "Completion updated", icon: CircleCheck, tone: "neutral" };
      case "private_note": return { title: "Private note added", icon: NotebookPen, tone: "neutral" };
      case "expired": return { title: "Hold expired", icon: CalendarX, tone: "danger" };
      case "cancelled": return { title: "Booking cancelled", icon: CalendarX, tone: "danger" };
      case "no_show": return { title: "Marked as no-show", icon: CalendarX, tone: "danger" };
      case "reinstated": return { title: "Booking reinstated", icon: CalendarCheck, tone: "accent" };
    }
    return { title: "Booking updated", icon: CalendarCheck, tone: "neutral" };
  }
  if (kind === "customer") return { title: "Customer note added", icon: NotebookPen, tone: "neutral" };
  if (kind === "service") return { title: a === "created" ? "Service added" : "Service updated", icon: Settings2, tone: "neutral" };
  return { title: "Settings updated", icon: Settings2, tone: "neutral" };
}

function dayLabel(dayKey: string, today: string) {
  if (dayKey === today) return "Today";
  if (dayKey === addDays(today, -1)) return "Yesterday";
  return formatDateKey(dayKey);
}

/**
 * Recent activity as a day-grouped timeline: icon + plain-language title,
 * the original audit summary underneath, then time · who, and a link to the booking.
 */
export function ActivityFeed({
  events,
  today,
  bookingRefs,
}: {
  events: AuditEvent[];
  today: string;
  /** bookingId → reference, for the "Open HC-…" link. */
  bookingRefs: Map<string, string>;
}) {
  const groups: { day: string; items: AuditEvent[] }[] = [];
  for (const e of events) {
    const day = lagosDateKey(e.at);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.day} aria-label={dayLabel(g.day, today)}>
          <h3 className="type-caps mb-3 text-[0.68rem] text-ink-3">{dayLabel(g.day, today)}</h3>
          <ol className="relative">
            {g.items.map((e, i) => {
              const d = describe(e.action);
              const ref = e.bookingId ? bookingRefs.get(e.bookingId) : undefined;
              const isLast = i === g.items.length - 1;
              return (
                <li key={e.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                  {!isLast && <span aria-hidden className="absolute left-4 top-9 bottom-0 w-px -translate-x-1/2 bg-line" />}
                  <span className={cx("relative grid size-8 shrink-0 place-items-center rounded-full", TONE[d.tone])}>
                    <d.icon aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold text-ink">{d.title}</p>
                      <time dateTime={e.at} className="shrink-0 text-xs tabular text-ink-3">{formatTime(e.at)}</time>
                    </div>
                    <p className="mt-0.5 text-sm leading-snug text-ink-2 [overflow-wrap:anywhere]">{e.summary}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                      <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-2">{e.actor}</span>
                      {ref && e.bookingId && (
                        <Link href={`/admin/bookings/${e.bookingId}`} className="font-semibold text-accent-text underline decoration-line-strong underline-offset-2 hover:decoration-accent">
                          {ref}
                        </Link>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
