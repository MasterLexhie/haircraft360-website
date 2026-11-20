import "server-only";
import { balanceDue } from "@/domain/pricing";
import { formatNaira } from "@/lib/money";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { db } from "../db";
import { audit } from "../audit";
import { BookingError, type Actor } from "../booking-service";
import { BALANCE_STATUSES, balanceToPay, openAttempt, type StartedPayment } from "./checkout";

/**
 * Balance links (BUILD_SPEC 6.4): the owner makes one and sends it; the customer pays the
 * balance on /pay/<token>. The URL carries the token and only its hash is stored. A link
 * can be opened any number of times until it expires; every press of Pay is a fresh transaction.
 */

const DAY_MS = 86_400_000;
export const PAYMENT_LINK_DAYS = 14;

async function findLink(token: string) {
  if (!token) return null;
  const link = await db.paymentLink.findUnique({
    where: { tokenHash: await sha256Hex(token) },
    include: { booking: { include: { items: { orderBy: { createdAt: "asc" } }, payments: true } } },
  });
  return link && link.expiresAt.getTime() > Date.now() ? link : null;
}

/** A balance link for the owner to send. Older links keep working until they expire. */
export async function createBalanceLink(bookingId: string, actor: Actor): Promise<{ url: string; expiresAt: string; amountKobo: number }> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { payments: true } });
  if (!booking) throw new BookingError("NOT_FOUND", "Booking not found.");
  const amountKobo = balanceToPay(booking);
  const token = randomToken();
  const expiresAt = new Date(Date.now() + PAYMENT_LINK_DAYS * DAY_MS);
  await db.$transaction(async (tx) => {
    await tx.paymentLink.create({ data: { tokenHash: await sha256Hex(token), bookingId, purpose: "balance", expiresAt, createdById: actor.id } });
    await audit(tx, {
      action: "payment.balance_link.created",
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "Booking",
      entityId: bookingId,
      bookingId,
      customerId: booking.customerId,
      summary: `Balance link made for ${formatNaira(amountKobo)}, valid for ${PAYMENT_LINK_DAYS} days`,
    });
  });
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return { url: `${base}/pay/${token}`, expiresAt: expiresAt.toISOString(), amountKobo };
}

/** What the /pay page shows: only this booking's own details. */
export async function getPaymentLinkView(token: string) {
  const link = await findLink(token);
  if (!link) return null;
  const b = link.booking;
  return {
    reference: b.reference,
    contactName: b.contactName,
    status: b.status,
    startAt: b.startAt.toISOString(),
    items: b.items.map((i) => ({ id: i.id, kind: i.kind, name: i.name, priceKobo: i.priceKobo })),
    totalKobo: b.totalKobo,
    paidKobo: b.payments.filter((p) => p.status === "success").reduce((s, p) => s + p.amountKobo, 0),
    dueKobo: (BALANCE_STATUSES as readonly string[]).includes(b.status) ? balanceDue(b, b.payments) : 0,
    expiresAt: link.expiresAt.toISOString(),
  };
}

export async function startLinkPayment(token: string): Promise<StartedPayment> {
  const link = await findLink(token);
  if (!link) throw new BookingError("NOT_FOUND", "This payment link has expired or isn't valid. Ask the salon for a new one.");
  return openAttempt(link.booking, "balance_online", balanceToPay(link.booking), link.id);
}
