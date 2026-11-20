import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { dayDetail } from "@/server/finances";
import { paymentMethodLabel, paymentTypeLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatDateKey, formatTime, isValidDateKey } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/bits";
import { Skeleton, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Day in finances" };

export default function FinanceDayPage({ params }: { params: Promise<{ date: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <FinanceDay params={params} />
    </Suspense>
  );
}

const money = (kobo: number) => (kobo < 0 ? `minus ${formatNaira(-kobo)}` : formatNaira(kobo));

async function FinanceDay({ params }: { params: Promise<{ date: string }> }) {
  await requireAdmin();
  const { date } = await params;
  if (!isValidDateKey(date)) notFound();
  const { payments, expenses, totals } = await dayDetail(date);

  return (
    <>
      <PageHeader
        back={{ href: `/admin/finances?period=custom&from=${date}&to=${date}`, label: "Finances" }}
        title={formatDateKey(date, { long: true })}
        description={`Revenue ${formatNaira(totals.revenueKobo)} · Expenses ${formatNaira(totals.expensesKobo)} · Net ${money(totals.netKobo)}`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Money in (${payments.length})`}>
          {payments.length === 0 ? (
            <p className="text-sm text-ink-3">No payments received this day.</p>
          ) : (
            <ul className="divide-y divide-line">
              {payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 py-3 text-sm first:pt-0">
                  <span className="min-w-0">
                    <Link href={`/admin/bookings/${p.bookingId}`} className="font-medium underline-offset-2 hover:underline">
                      {p.customerName} · {p.bookingReference}
                    </Link>
                    <span className="block text-ink-3">
                      {formatTime(p.at)} · {paymentTypeLabel[p.type]} · {paymentMethodLabel[p.method]}
                      {p.recordedByName ? ` · recorded by ${p.recordedByName}` : ""}
                    </span>
                    {p.note && <span className="block text-ink-2">{p.note}</span>}
                  </span>
                  <span className={cx("tabular shrink-0 font-semibold", p.amountKobo < 0 && "text-danger")}>{money(p.amountKobo)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={`Money out (${expenses.length})`}>
          {expenses.length === 0 ? (
            <p className="text-sm text-ink-3">No expenses this day.</p>
          ) : (
            <ul className="divide-y divide-line">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-4 py-3 text-sm first:pt-0">
                  <span className="min-w-0">
                    <Link href={`/admin/finances/expenses/${e.id}`} className="font-medium underline-offset-2 hover:underline">
                      {e.categoryName}
                    </Link>
                    <span className="block text-ink-3">{paymentMethodLabel[e.method]}</span>
                    {e.note && <span className="block text-ink-2">{e.note}</span>}
                  </span>
                  <span className="tabular shrink-0 font-semibold">{formatNaira(e.amountKobo)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
