import "server-only";
import { salonFrom, type Salon } from "@/domain/salon";
import { connection } from "next/server";
import type { Booking, Service, Settings } from "@/domain/types";
import { balanceDue } from "@/domain/pricing";
import { normalizePhone, normalizeEmail } from "@/domain/phone";
import { db } from "./db";
import { toPayment, toService } from "./mappers";
import { loadSettings } from "./settings";
import { findBookingByToken, occupancyBetween } from "./booking-service";
import { slotsForDate, type DateStatus } from "@/domain/availability";
import { addDays, lagosToUtcMs } from "@/lib/time";

/**
 * Read-side queries for Server Components. Each waits for a request (`connection()`),
 * so pages render live data instead of being prerendered at build time.
 * Customer-facing queries return only the booking's own data, never the stored
 * customer profile or other bookings (closes finding F-01).
 */

const serviceInclude = { addOns: { select: { addOnServiceId: true } } } as const;

export async function getActiveServices(): Promise<Service[]> {
  await connection();
  const rows = await db.service.findMany({ where: { active: true }, include: serviceInclude, orderBy: { sortOrder: "asc" } });
  return rows.map(toService);
}

export async function getBookingConfig(): Promise<{ services: Service[]; settings: Settings }> {
  await connection();
  const [rows, settings] = await Promise.all([
    db.service.findMany({ where: { active: true }, include: serviceInclude, orderBy: { sortOrder: "asc" } }),
    loadSettings(),
  ]);
  return { services: rows.map(toService), settings };
}

export async function getPublicSettings(): Promise<Settings> {
  await connection();
  return loadSettings();
}

/** The salon's name, address, phone and links, from Settings. */
export async function getSalon(): Promise<Salon> {
  await connection();
  return salonFrom((await loadSettings()).salonDetails);
}

/** Customer booking page. Requires the link token. Shows what was typed for this booking only. */
export async function getCustomerBooking(reference: string, token: string | undefined) {
  await connection();
  const booking = await findBookingByToken(reference, token);
  if (!booking) return null;
  const payments = await db.payment.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "asc" } });
  return {
    booking: withoutPrivate(booking),
    payments: payments.map((p) => ({ ...toPayment(p), recordedByName: null })),
    /** Confirmed and still ahead: the calendar buttons show. */
    upcoming: booking.status === "confirmed" && Date.parse(booking.startAt) > Date.now(),
  };
}

export type PublicBooking = Omit<Booking, "privateNote" | "customerId">;

function withoutPrivate(b: Booking): PublicBooking {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { privateNote, customerId, ...rest } = b;
  return rest;
}

/**
 * "Find my booking": reference plus the phone or email used for that booking.
 * Returns only date, time, status and balance (decision D6). Never contact details or links.
 */
export async function findBookingSummary(reference: string, contact: string) {
  await connection();
  const booking = await db.booking.findUnique({ where: { reference: reference.trim().toUpperCase() }, include: { items: true, payments: true } });
  if (!booking) return null;
  const phone = normalizePhone(contact);
  const email = normalizeEmail(contact);
  const matches = (phone !== null && phone === booking.contactPhone) || (booking.contactEmail !== null && email === booking.contactEmail);
  if (!matches) return null;
  return {
    reference: booking.reference,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    status: booking.status,
    balanceKobo: balanceDue(booking, booking.payments),
  };
}

/* ───────────────────────────── Admin queries ───────────────────────────── */

/** Current time for a request-rendered page (after connection(), so never prerendered). */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}

/**
 * Free start times on one day for moving a booking (admin). The booking never counts against
 * itself, and the customer lead time doesn't apply: the salon can fit someone in at short notice.
 */
export async function getMoveSlots(booking: { id: string; startAt: string; endAt: string }, dateKey: string): Promise<{ status: DateStatus; startTimes: string[] }> {
  await connection();
  const nowMs = Date.now();
  const settings = await loadSettings();
  const occupancy = await occupancyBetween(db, new Date(lagosToUtcMs(addDays(dateKey, -1), 0)), new Date(lagosToUtcMs(addDays(dateKey, 2), 0)));
  const { status, slots } = slotsForDate({
    dateKey,
    durationMinutes: Math.round((Date.parse(booking.endAt) - Date.parse(booking.startAt)) / 60_000),
    config: { ...settings.availability, minimumLeadMinutes: 0 },
    ...occupancy,
    nowMs,
    excludeBookingId: booking.id,
  });
  return { status, startTimes: slots.filter((s) => s.available && s.startAt !== booking.startAt).map((s) => s.startAt) };
}

export interface BlockRow {
  id: string;
  startAt: string;
  endAt: string;
  capacityReduction: number | null;
  reason: string;
}

/** Closures that haven't finished yet, soonest first (admin Settings). */
export async function getUpcomingBlocks(): Promise<BlockRow[]> {
  await connection();
  const rows = await db.block.findMany({ where: { endAt: { gt: new Date() } }, orderBy: { startAt: "asc" } });
  return rows.map((b) => ({ id: b.id, startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString(), capacityReduction: b.capacityReduction, reason: b.reason }));
}
