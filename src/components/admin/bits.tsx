import Link from "next/link";
import type { ReactNode } from "react";
import type { Booking, Payment } from "@/domain/types";
import { bookingStatusLabel, paymentSummaryLabel } from "@/domain/labels";
import { paymentSummaryState } from "@/domain/pricing";
import { Badge, cx } from "@/components/ui/primitives";

export function BookingStatusBadge({ status }: { status: Booking["status"] }) {
  const s = bookingStatusLabel[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PaymentStateBadge({ booking, payments }: { booking: Booking; payments: Payment[] }) {
  const s = paymentSummaryLabel[paymentSummaryState(booking, payments)];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex min-h-8 items-center text-sm font-medium text-ink-2 hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="type-display text-[2rem] sm:text-[2.4rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
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
    <section className={cx("rounded-[var(--radius)] border border-line bg-surface", className)}>
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
