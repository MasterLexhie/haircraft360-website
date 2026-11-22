import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Booking, Payment } from "@/domain/types";
import { bookingStatusLabel, paymentSummaryLabel } from "@/domain/labels";
import { paymentSummaryState } from "@/domain/pricing";
import { visitLabel, type VisitInfo } from "@/domain/crm";
import { Badge, cx } from "@/components/ui/primitives";

export function BookingStatusBadge({ status }: { status: Booking["status"] }) {
  const s = bookingStatusLabel[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** "New" or "Returning, 5th visit" (Spec 6.5). */
export function VisitBadge({ visit }: { visit: VisitInfo }) {
  return <Badge tone={visit.returning ? "accent" : "info"}>{visitLabel(visit)}</Badge>;
}

export function PaymentStateBadge({ booking, payments }: { booking: Booking; payments: Payment[] }) {
  const s = paymentSummaryLabel[paymentSummaryState(booking, payments)];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/**
 * Page title. On a phone it becomes the plum header at the top of the page: the logo (or a
 * back arrow), the title, and a search button. From tablet up it sits on the grey workspace
 * under the shell's top bar. `phoneBack` adds a back arrow on phones only, for pages reached
 * from the More tab.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  phoneBack,
  phoneActions = true,
  closeIcon = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  phoneBack?: { href: string; label: string };
  /** Set false when the page shows its actions somewhere else on a phone. */
  phoneActions?: boolean;
  /** A full-screen task (like adding an expense): the phone header shows × instead of a back arrow. */
  closeIcon?: boolean;
}) {
  const up = back ?? phoneBack;
  return (
    <>
      <div className="on-night -mx-4 mb-4 bg-night px-4 pb-4 text-on-night md:hidden" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex items-start gap-2.5">
          {up ? (
            <Link href={up.href} className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-on-night/10 hover:bg-on-night/15">
              {closeIcon ? <X aria-hidden className="size-[18px]" /> : <ChevronLeft aria-hidden className="size-[18px]" />}
              <span className="sr-only">{closeIcon ? `Close, back to ${up.label}` : `Back to ${up.label}`}</span>
            </Link>
          ) : (
            <Image src="/brand/logo-pink-full.webp" alt="" width={569} height={571} className="mt-1 size-8 shrink-0" />
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="font-display text-[1.5rem] font-normal leading-tight [&_[data-badge]]:align-middle">{title}</h1>
            {description && <p className="mt-0.5 text-[0.8rem] text-on-night-2">{description}</p>}
          </div>
          <Link href="/admin/search" className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-on-night/10 hover:bg-on-night/15">
            <Search aria-hidden className="size-[18px]" />
            <span className="sr-only">Search bookings and customers</span>
          </Link>
        </div>
      </div>
      <div className={cx("mb-4 gap-3 md:mb-6 md:flex md:flex-col lg:flex-row lg:items-end lg:justify-between", (!actions || !phoneActions) && "max-md:hidden")}>
        <div className="hidden min-w-0 md:block">
          {back && (
            <Link href={back.href} className="mb-1 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
              <ChevronLeft aria-hidden className="size-4" /> {back.label}
            </Link>
          )}
          <h1 className="type-display text-[1.9rem] font-normal">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Replaces the default body padding. */
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)]", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {action}
        </div>
      )}
      <div className={bodyClassName ?? "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium text-ink-3">{i.label}</dt>
          <dd className="mt-0.5 break-words text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
