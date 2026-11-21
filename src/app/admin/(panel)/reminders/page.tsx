import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { MessageCircle } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { manualMessagesDue, type ManualMessage } from "@/server/whatsapp-messages";
import { formatLongDate, formatTime } from "@/lib/time";
import { PageHeader } from "@/components/admin/bits";
import { WhatsappSend } from "@/components/admin/whatsapp-send";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Reminders due" };

export default function RemindersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Reminders />
    </Suspense>
  );
}

async function Reminders() {
  await requireAdmin();
  await connection();
  const messages = await manualMessagesDue();
  const confirmations = messages.filter((m) => m.type === "confirmation");
  const reminders = messages.filter((m) => m.type === "reminder");

  return (
    <div>
      <PageHeader
        title="Reminders due"
        description="Customers without an email get their messages on WhatsApp, or by text or call if they said they aren't on WhatsApp. Send each one, then tap Mark as sent. A message stays here until you mark it."
      />
      {messages.length === 0 ? (
        <EmptyState icon={<MessageCircle aria-hidden className="size-6" />} title="Nothing to send today">
          Customers with an email get their confirmation and reminder automatically.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <Group title="Confirmations" items={confirmations} />
          <Group title="Reminders for the next day" items={reminders} />
        </div>
      )}
    </div>
  );
}

function Group({ title, items }: { title: string; items: ManualMessage[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`group-${title}`}>
      <h2 id={`group-${title}`} className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">
        {title} ({items.length})
      </h2>
      <ul className="space-y-3">
        {items.map((m) => (
          <li key={m.id}>
            <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">
                  <Link href={`/admin/bookings/${m.bookingId}`} className="underline-offset-2 hover:underline">
                    {m.name}
                  </Link>{" "}
                  <Badge tone="neutral" className="ml-1 align-middle">
                    {m.reference}
                  </Badge>
                </p>
                <p className="text-sm text-ink-2">
                  {formatLongDate(m.startAt)}, {formatTime(m.startAt)} · {m.phone}
                </p>
                <p className="mt-2 whitespace-pre-line rounded-[var(--radius)] bg-accent-soft/60 p-3 text-sm text-ink-2">{m.text}</p>
              </div>
              <div className="shrink-0">
                <WhatsappSend message={m} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
