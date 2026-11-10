import "server-only";
import { connection } from "next/server";
import type { Booking, Customer, Database, Payment, Service, Settings } from "@/domain/types";
import { readDb, transaction } from "./store";
import { sweepExpiredHolds } from "./booking-service";

/**
 * Read-side queries used by Server Components. Each call waits for a request
 * (`connection()`), so pages always render fresh mock data instead of being
 * prerendered at build time.
 *
 * Customer-facing queries return "public" shapes that never include private
 * admin notes.
 */

async function freshDb(): Promise<Database> {
  await connection();
  const db = readDb();
  const nowMs = Date.now();
  const needsSweep = db.bookings.some(
    (b) => b.status === "awaiting_deposit" && b.holdExpiresAt && Date.parse(b.holdExpiresAt) <= nowMs,
  );
  if (needsSweep) transaction((d) => sweepExpiredHolds(d, nowMs));
  return readDb();
}

export async function getActiveServices(): Promise<Service[]> {
  const db = await freshDb();
  return db.services.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getBookingConfig(): Promise<{ services: Service[]; settings: Settings }> {
  const db = await freshDb();
  return {
    services: db.services.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder),
    settings: db.settings,
  };
}

export async function getPublicSettings(): Promise<Pick<Settings, "availability" | "availabilityStatus" | "deposit" | "depositStatus">> {
  const { settings } = await freshDb();
  return {
    availability: settings.availability,
    availabilityStatus: settings.availabilityStatus,
    deposit: settings.deposit,
    depositStatus: settings.depositStatus,
  };
}

export type PublicBooking = Omit<Booking, "privateNote" | "accessToken">;
export type PublicCustomer = Pick<Customer, "name" | "phone" | "email">;

function toPublicBooking(b: Booking): PublicBooking {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { privateNote, accessToken, ...rest } = b;
  return rest;
}

/** Customer booking page. Requires the booking's access token. */
export async function getCustomerBooking(reference: string, token: string | undefined) {
  const db = await freshDb();
  const booking = db.bookings.find((b) => b.reference === reference);
  if (!booking || !token || booking.accessToken !== token) return null;
  const customer = db.customers.find((c) => c.id === booking.customerId)!;
  // Customer history: every booking linked to this customer, newest first.
  const history = db.bookings
    .filter((b) => b.customerId === customer.id)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .map((b) => ({ reference: b.reference, startAt: b.startAt, status: b.status, isCurrent: b.id === booking.id, token: b.accessToken }));
  return {
    booking: toPublicBooking(booking),
    customer: { name: customer.name, phone: customer.phone, email: customer.email } satisfies PublicCustomer,
    payments: db.payments.filter((p) => p.bookingId === booking.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    history,
  };
}

/** Mock checkout page. */
export async function getCheckout(checkoutReference: string) {
  const db = await freshDb();
  const payment = db.payments.find((p) => p.reference === checkoutReference && p.source === "mock_checkout");
  if (!payment) return null;
  const booking = db.bookings.find((b) => b.id === payment.bookingId)!;
  return { payment, booking: toPublicBooking(booking), accessToken: booking.accessToken };
}

/** Lookup by reference + phone/email, used by "Find my booking". */
export async function findBookingForCustomer(reference: string, contact: string) {
  const db = await freshDb();
  const booking = db.bookings.find((b) => b.reference.toUpperCase() === reference.trim().toUpperCase());
  if (!booking) return null;
  const customer = db.customers.find((c) => c.id === booking.customerId)!;
  const digits = contact.replace(/\D/g, "").replace(/^234/, "0");
  const matches =
    (customer.phone && digits.length >= 10 && customer.phone.endsWith(digits.slice(-10))) ||
    (customer.email && customer.email.toLowerCase() === contact.trim().toLowerCase());
  return matches ? { reference: booking.reference, token: booking.accessToken } : null;
}

/* ───────────────────────────── Admin queries ───────────────────────────── */

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

export async function getAdminData(): Promise<Database> {
  return freshDb();
}

export function joinBooking(db: Database, b: Booking): AdminBookingRow {
  return {
    booking: b,
    customer: db.customers.find((c) => c.id === b.customerId)!,
    payments: db.payments.filter((p) => p.bookingId === b.id).sort((x, y) => x.createdAt.localeCompare(y.createdAt)),
  };
}
