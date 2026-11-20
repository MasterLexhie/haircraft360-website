import type { Booking, Kobo, Payment } from "./types";
import { balanceDue, paidKobo } from "./pricing";

/**
 * Customer facts for the admin (BUILD_SPEC 6.5). Pure: give it one customer's bookings and
 * the payments on them. Money is the Payment ledger, which never includes a transaction fee
 * the customer paid on top.
 */

export interface VisitInfo {
  /** Has a completed visit before this booking. */
  returning: boolean;
  /** This booking's place among the customer's visits: 1 for a first visit. */
  visitNumber: number;
}

/** "Returning" means a completed booking that started before this one (Spec 6.5). */
export function visitInfo(booking: Pick<Booking, "id" | "startAt">, customerBookings: Pick<Booking, "id" | "startAt" | "status">[]): VisitInfo {
  const before = customerBookings.filter((b) => b.id !== booking.id && b.status === "completed" && b.startAt < booking.startAt).length;
  return { returning: before > 0, visitNumber: before + 1 };
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export function visitLabel(v: VisitInfo): string {
  return v.returning ? `Returning, ${ordinal(v.visitNumber)} visit` : "New";
}

export interface CustomerStats {
  /** Completed bookings. */
  visits: number;
  /** Everything recorded as paid, on any of their bookings. */
  totalSpendKobo: Kobo;
  /** Paid on completed bookings, per visit. Null before the first visit. */
  averageSpendKobo: Kobo | null;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
  /** Main services across completed visits, most frequent first (at most three). */
  usualServices: { name: string; count: number }[];
  noShows: number;
  /** Left to pay on completed visits. */
  outstandingKobo: Kobo;
}

export function customerStats(bookings: Booking[], payments: Pick<Payment, "bookingId" | "status" | "amountKobo">[], nowMs: number): CustomerStats {
  const paymentsOf = (id: string) => payments.filter((p) => p.bookingId === id);
  const completed = bookings.filter((b) => b.status === "completed");
  const paidOnVisits = completed.reduce((s, b) => s + paidKobo(paymentsOf(b.id)), 0);

  const counts = new Map<string, number>();
  for (const b of completed) {
    const main = b.items.find((i) => i.kind === "main");
    if (main) counts.set(main.name, (counts.get(main.name) ?? 0) + 1);
  }
  const usualServices = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3);

  const upcoming = bookings.filter((b) => b.status === "confirmed" && Date.parse(b.startAt) > nowMs).map((b) => b.startAt).sort();

  return {
    visits: completed.length,
    totalSpendKobo: paidKobo(payments),
    averageSpendKobo: completed.length ? Math.round(paidOnVisits / completed.length) : null,
    lastVisitAt: completed.map((b) => b.startAt).sort().at(-1) ?? null,
    nextVisitAt: upcoming[0] ?? null,
    usualServices,
    noShows: bookings.filter((b) => b.status === "no_show").length,
    outstandingKobo: completed.reduce((s, b) => s + balanceDue(b, paymentsOf(b.id)), 0),
  };
}

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 24;

/**
 * Tags the owner puts on a customer (for example VIP). Trimmed, inner spaces collapsed,
 * duplicates dropped regardless of capitals (the first spelling wins). Returns an error
 * message instead of the tags when a limit is broken.
 */
export function normalizeTags(input: string[]): { tags: string[] } | { error: string } {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) return { error: `Keep each tag to ${MAX_TAG_LENGTH} characters ("${tag.slice(0, 30)}" is longer).` };
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length > MAX_TAGS) return { error: `A customer can have up to ${MAX_TAGS} tags.` };
  return { tags };
}
