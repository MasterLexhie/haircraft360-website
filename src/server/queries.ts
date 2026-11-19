import "server-only";
import { connection } from "next/server";
import type { AuditEvent, Booking, Customer, Payment, Service, Settings } from "@/domain/types";
import { balanceDue } from "@/domain/pricing";
import { normalizePhone, normalizeEmail } from "@/domain/phone";
import { db } from "./db";
import { toAuditEvent, toBooking, toCustomer, toPayment, toService } from "./mappers";
import { loadSettings } from "./settings";
import { findBookingByToken } from "./booking-service";

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

/** Customer booking page. Requires the link token. Shows what was typed for this booking only. */
export async function getCustomerBooking(reference: string, token: string | undefined) {
  await connection();
  const booking = await findBookingByToken(reference, token);
  if (!booking) return null;
  const payments = await db.payment.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "asc" } });
  return { booking: withoutPrivate(booking), payments: payments.map((p) => ({ ...toPayment(p), recordedByName: null })) };
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

export interface AdminSnapshot {
  bookings: Booking[];
  customers: Customer[];
  payments: Payment[];
  audit: AuditEvent[];
  services: Service[];
  settings: Settings;
}

export interface AdminBookingRow {
  booking: Booking;
  customer: Customer;
  payments: Payment[];
}

/** Current time for a request-rendered page (after connection(), so never prerendered). */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}

/**
 * Everything the admin pages need, loaded at once. Fine at the salon's volume
 * (about 100 bookings a week); Milestone 7 replaces the dashboard's use with targeted queries.
 */
export async function getAdminData(): Promise<AdminSnapshot> {
  await connection();
  const [bookings, customers, payments, audit, services, settings] = await Promise.all([
    db.booking.findMany({ include: { items: true }, orderBy: { startAt: "asc" } }),
    db.customer.findMany({ include: { phones: true, emails: true }, orderBy: { createdAt: "asc" } }),
    db.payment.findMany({ include: { recordedBy: { select: { displayName: true } } }, orderBy: { createdAt: "asc" } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    db.service.findMany({ include: serviceInclude, orderBy: { sortOrder: "asc" } }),
    loadSettings(),
  ]);
  return {
    bookings: bookings.map(toBooking),
    customers: customers.map(toCustomer),
    payments: payments.map(toPayment),
    audit: audit.map(toAuditEvent),
    services: services.map(toService),
    settings,
  };
}

export function joinBooking(snapshot: Pick<AdminSnapshot, "customers" | "payments">, b: Booking): AdminBookingRow {
  return {
    booking: b,
    customer: snapshot.customers.find((c) => c.id === b.customerId)!,
    payments: snapshot.payments.filter((p) => p.bookingId === b.id),
  };
}
