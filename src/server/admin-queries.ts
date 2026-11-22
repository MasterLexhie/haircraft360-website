import "server-only";
import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditEvent, Booking, BookingStatus, Customer, Payment, Service, Settings } from "@/domain/types";
import { visitInfo, type VisitInfo } from "@/domain/crm";
import { balanceDue, paidKobo, paymentSummaryState } from "@/domain/pricing";
import { paginate, type PageOf } from "@/domain/paginate";
import { bookingStatusLabel } from "@/domain/labels";
import { isValidDateKey } from "@/lib/time";
import { addDays, lagosDateKey, lagosToUtcMs } from "@/lib/time";
import { db } from "./db";
import { toAuditEvent, toBooking, toCustomer, toPayment, toService } from "./mappers";
import { loadSettings } from "./settings";

/**
 * Admin reads. Each page asks only for the rows it shows, so the data sent from the database
 * stays about the same size however many bookings and customers build up.
 */

export interface AdminBookingRow {
  booking: Booking;
  customer: Customer;
  payments: Payment[];
  /** New or returning, and which visit this is (Spec 6.5). */
  visit: VisitInfo;
}

const rowInclude = {
  items: true,
  payments: { include: { recordedBy: { select: { displayName: true } } }, orderBy: { createdAt: "asc" } },
  customer: { include: { phones: true, emails: true } },
} satisfies Prisma.BookingInclude;

const serviceInclude = { addOns: { select: { addOnServiceId: true } } } as const;

/** Start of `fromKey` to the end of `toKey`, both Lagos dates, as UTC instants. */
export function lagosDayRange(fromKey: string, toKey: string): { gte: Date; lt: Date } {
  return { gte: new Date(lagosToUtcMs(fromKey, 0)), lt: new Date(lagosToUtcMs(addDays(toKey, 1), 0)) };
}

/** New or returning for each booking, from the completed visits of only these customers. */
export async function visitsFor(bookings: { id: string; customerId: string; startAt: string }[]): Promise<Map<string, VisitInfo>> {
  const customerIds = [...new Set(bookings.map((b) => b.customerId))];
  const completed = customerIds.length
    ? await db.booking.findMany({ where: { customerId: { in: customerIds }, status: "completed" }, select: { id: true, customerId: true, startAt: true, status: true } })
    : [];
  const byCustomer = new Map<string, { id: string; startAt: string; status: BookingStatus }[]>();
  for (const c of completed) {
    const list = byCustomer.get(c.customerId) ?? [];
    list.push({ id: c.id, startAt: c.startAt.toISOString(), status: c.status });
    byCustomer.set(c.customerId, list);
  }
  return new Map(bookings.map((b) => [b.id, visitInfo(b, byCustomer.get(b.customerId) ?? [])]));
}

/** Full rows for a small, bounded set of bookings (a page, today's schedule, one booking). */
async function adminRows(where: Prisma.BookingWhereInput, take?: number): Promise<AdminBookingRow[]> {
  const rows = await db.booking.findMany({ where, include: rowInclude, orderBy: [{ startAt: "asc" }, { id: "asc" }], take });
  const bookings = rows.map(toBooking);
  const visits = await visitsFor(bookings);
  return rows.map((r, i) => ({
    booking: bookings[i]!,
    customer: toCustomer(r.customer),
    payments: r.payments.map(toPayment),
    visit: visits.get(r.id)!,
  }));
}

/** "0803 555" also finds +234803555...: the digits as typed, and with a leading 0 as 234. */
export function phoneNeedles(q: string): string[] {
  const digits = q.replace(/\D/g, "");
  if (digits.length < 3) return [];
  return [...new Set([digits, digits.startsWith("0") ? `234${digits.slice(1)}` : digits])];
}

const text = (q: string) => ({ contains: q, mode: "insensitive" as const });

// Booking detail

export async function getAdminBooking(id: string): Promise<AdminBookingRow | null> {
  await connection();
  const [row] = await adminRows({ id });
  return row ?? null;
}

/** Everything recorded about one booking, newest first. */
export async function bookingAudit(bookingId: string): Promise<AuditEvent[]> {
  const rows = await db.auditLog.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" } });
  return rows.map(toAuditEvent);
}

// Settings

export async function getAdminSettings(): Promise<{ services: Service[]; settings: Settings }> {
  await connection();
  const [services, settings] = await Promise.all([db.service.findMany({ include: serviceInclude, orderBy: { sortOrder: "asc" } }), loadSettings()]);
  return { services: services.map(toService), settings };
}

// Bookings list

export type BookingWhen = "upcoming" | "today" | "past" | "all";
export const BOOKING_WHEN: BookingWhen[] = ["upcoming", "today", "past", "all"];

export interface BookingFilters {
  q?: string;
  status?: string;
  payment?: string;
  from?: string;
  to?: string;
  /** Time window. Upcoming and Today list soonest first; Past and All list newest first. Missing means all. */
  when?: string;
}

export interface BookingList extends PageOf<AdminBookingRow> {
  /** Every booking in the system, for "X of Y". */
  allCount: number;
  /** Matches for each status under the other filters, for the status tabs. */
  statusCounts: Record<BookingStatus, number>;
  /** Over every match, not just this page. */
  totalPaidKobo: number;
  /** Only completed appointments owe a balance; confirmed ones pay theirs on the day. */
  totalBalanceKobo: number;
}

function whenOf(f: BookingFilters): BookingWhen {
  return BOOKING_WHEN.includes(f.when as BookingWhen) ? (f.when as BookingWhen) : "all";
}

/** Everything except the status, which the status tabs count across. */
function bookingWhere(f: BookingFilters, nowMs: number): Prisma.BookingWhereInput {
  const and: Prisma.BookingWhereInput[] = [];
  const when = whenOf(f);
  const today = lagosDateKey(nowMs);
  if (when === "upcoming") and.push({ startAt: { gte: new Date(nowMs) } });
  if (when === "past") and.push({ startAt: { lt: new Date(nowMs) } });
  if (when === "today") and.push({ startAt: lagosDayRange(today, today) });
  const from = f.from && isValidDateKey(f.from) ? f.from : undefined;
  const to = f.to && isValidDateKey(f.to) ? f.to : undefined;
  if (from) and.push({ startAt: { gte: lagosDayRange(from, from).gte } });
  if (to) and.push({ startAt: { lt: lagosDayRange(to, to).lt } });
  const q = (f.q ?? "").trim();
  if (q) {
    and.push({
      OR: [
        { reference: text(q) },
        { contactName: text(q) },
        { customer: { displayName: text(q) } },
        { customer: { emails: { some: { value: text(q) } } } },
        ...[q, ...phoneNeedles(q)].map((n) => ({ customer: { phones: { some: { e164: { contains: n } } } } })),
        { items: { some: { name: text(q) } } },
      ],
    });
  }
  return { AND: and };
}

export async function listAdminBookings(f: BookingFilters, pageParam: string | undefined, pageSize: number, nowMs = Date.now()): Promise<BookingList> {
  await connection();
  const soonestFirst = whenOf(f) === "upcoming" || whenOf(f) === "today";
  // A light pass over every match: enough for the status tabs, the payment filter, the totals and the page count.
  const [light, allCount] = await Promise.all([
    db.booking.findMany({
      where: bookingWhere(f, nowMs),
      select: { id: true, status: true, totalKobo: true, payments: { select: { status: true, amountKobo: true } } },
      orderBy: [{ startAt: soonestFirst ? "asc" : "desc" }, { id: "asc" }],
    }),
    db.booking.count(),
  ]);
  const byPayment = f.payment ? light.filter((b) => paymentSummaryState(b, b.payments) === f.payment) : light;
  const statusCounts = Object.fromEntries(Object.keys(bookingStatusLabel).map((k) => [k, 0])) as Record<BookingStatus, number>;
  for (const b of byPayment) statusCounts[b.status as BookingStatus] += 1;
  const matching = f.status ? byPayment.filter((b) => b.status === f.status) : byPayment;
  const totalPaidKobo = matching.reduce((s, b) => s + paidKobo(b.payments), 0);
  const totalBalanceKobo = matching.filter((b) => b.status === "completed").reduce((s, b) => s + balanceDue(b, b.payments), 0);

  const page = paginate(matching, pageParam, pageSize);
  const ids = page.items.map((b) => b.id);
  const rows = ids.length ? await adminRows({ id: { in: ids } }) : [];
  const byId = new Map(rows.map((r) => [r.booking.id, r]));
  return { ...page, items: ids.map((id) => byId.get(id)!), allCount, statusCounts, totalPaidKobo, totalBalanceKobo };
}

// Dashboard

export interface MonthBooking {
  customerId: string;
  mainServices: string[];
  visit: VisitInfo;
}

export interface DashboardData {
  todays: AdminBookingRow[];
  nextUp: AdminBookingRow[];
  upcomingCount: number;
  awaitingCount: number;
  unpaid: AdminBookingRow[];
  /** This calendar month's booked appointments, oldest first. */
  month: MonthBooking[];
}

/** Completed bookings whose successful payments fall short of the total (the same rule as balanceDue > 0). */
export async function unpaidCompletedIds(): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT b.id
    FROM bookings b
    LEFT JOIN payments p ON p.booking_id = b.id AND p.status = 'success'
    WHERE b.status = 'completed'
    GROUP BY b.id
    HAVING b.total_kobo > COALESCE(SUM(p.amount_kobo), 0)`;
  return rows.map((r) => r.id);
}

function monthStartKey(dateKey: string, offset: number): string {
  const [y, m] = dateKey.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + offset;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

export async function getDashboard(nowMs: number, today: string): Promise<DashboardData> {
  await connection();
  const now = new Date(nowMs);
  const todayRange = lagosDayRange(today, today);
  const weekRange = lagosDayRange(today, addDays(today, 7));
  const monthRange = { gte: new Date(lagosToUtcMs(monthStartKey(today, 0), 0)), lt: new Date(lagosToUtcMs(monthStartKey(today, 1), 0)) };

  const [todays, nextUp, upcomingCount, awaitingCount, unpaidIds, monthRows] = await Promise.all([
    adminRows({ status: { in: ["confirmed", "completed"] }, startAt: todayRange }),
    adminRows({ status: "confirmed", startAt: { gt: now } }, 5),
    db.booking.count({ where: { status: "confirmed", startAt: { gt: now, lt: weekRange.lt } } }),
    db.booking.count({ where: { status: "pending_payment", holdExpiresAt: { gt: now } } }),
    unpaidCompletedIds(),
    db.booking.findMany({
      where: { status: { in: ["confirmed", "completed", "needs_attention"] }, startAt: monthRange },
      select: { id: true, customerId: true, startAt: true, items: { where: { kind: "main" }, select: { name: true } } },
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
    }),
  ]);
  const unpaid = unpaidIds.length ? await adminRows({ id: { in: unpaidIds } }) : [];
  const visits = await visitsFor(monthRows.map((b) => ({ id: b.id, customerId: b.customerId, startAt: b.startAt.toISOString() })));
  const month = monthRows.map((b) => ({ customerId: b.customerId, mainServices: b.items.map((i) => i.name), visit: visits.get(b.id)! }));
  return { todays, nextUp, upcomingCount, awaitingCount, unpaid, month };
}

// Customers

export interface CustomerListRow {
  customer: Customer;
  bookingCount: number;
  paidKobo: number;
  outstandingKobo: number;
  lastVisitAt: string | null;
}

export async function listAdminCustomers(q: string, pageParam: string | undefined, pageSize: number): Promise<PageOf<CustomerListRow>> {
  await connection();
  const needle = q.trim();
  const where: Prisma.CustomerWhereInput = needle
    ? {
        OR: [
          { displayName: text(needle) },
          { emails: { some: { value: text(needle) } } },
          ...[needle, ...phoneNeedles(needle)].map((n) => ({ phones: { some: { e164: { contains: n } } } })),
        ],
      }
    : {};
  // Light pass: each customer with only their latest booking time, for the order and the page count.
  const light = await db.customer.findMany({ where, select: { id: true, bookings: { select: { startAt: true }, orderBy: { startAt: "desc" }, take: 1 } } });
  const ordered = light
    .map((c) => ({ id: c.id, last: c.bookings[0]?.startAt.toISOString() ?? "" }))
    .sort((a, b) => b.last.localeCompare(a.last) || a.id.localeCompare(b.id));
  const page = paginate(ordered, pageParam, pageSize);
  const ids = page.items.map((c) => c.id);
  const rows = ids.length
    ? await db.customer.findMany({
        where: { id: { in: ids } },
        include: {
          phones: true,
          emails: true,
          bookings: { select: { status: true, totalKobo: true, startAt: true, payments: { select: { status: true, amountKobo: true } } } },
        },
      })
    : [];
  const byId = new Map(
    rows.map((c) => {
      const payments = c.bookings.flatMap((b) => b.payments);
      const outstanding = c.bookings.filter((b) => b.status === "completed").reduce((s, b) => s + balanceDue(b, b.payments), 0);
      const last = c.bookings.map((b) => b.startAt.toISOString()).sort().at(-1) ?? null;
      return [c.id, { customer: toCustomer(c), bookingCount: c.bookings.length, paidKobo: paidKobo(payments), outstandingKobo: outstanding, lastVisitAt: last }];
    }),
  );
  return { ...page, items: ids.map((id) => byId.get(id)!) };
}

export async function getCustomerProfile(id: string): Promise<{ customer: Customer; bookings: Booking[]; payments: Payment[] } | null> {
  await connection();
  const row = await db.customer.findUnique({
    where: { id },
    include: {
      phones: true,
      emails: true,
      bookings: { include: { items: true, payments: { include: { recordedBy: { select: { displayName: true } } } } }, orderBy: [{ startAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!row) return null;
  const payments = row.bookings
    .flatMap((b) => b.payments)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(toPayment);
  return { customer: toCustomer(row), bookings: row.bookings.map(toBooking), payments };
}

// Search (top bar dropdown and the search screen)

export interface SearchCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bookingCount: number;
}

export interface SearchBooking {
  id: string;
  reference: string;
  customerName: string;
  services: string;
  startAt: string;
  totalKobo: number;
  /** paymentSummaryState, for the label and colour. */
  payment: string;
  status: BookingStatus;
}

export interface AdminSearch {
  customers: SearchCustomer[];
  bookings: SearchBooking[];
  customerCount: number;
  bookingCount: number;
}

/** Customers and bookings matching a name, phone, email, reference or service. Bookings soonest upcoming first, then past, newest first. */
export async function searchAdmin(q: string, take: number, nowMs = Date.now()): Promise<AdminSearch> {
  await connection();
  const needle = q.trim();
  if (needle.length < 2) return { customers: [], bookings: [], customerCount: 0, bookingCount: 0 };
  const customerWhere: Prisma.CustomerWhereInput = {
    OR: [
      { displayName: text(needle) },
      { emails: { some: { value: text(needle) } } },
      ...[needle, ...phoneNeedles(needle)].map((n) => ({ phones: { some: { e164: { contains: n } } } })),
    ],
  };
  const bookingWhereQ = bookingWhere({ q: needle }, nowMs);
  const now = new Date(nowMs);
  const bookingSelect = {
    id: true,
    reference: true,
    startAt: true,
    status: true,
    totalKobo: true,
    contactName: true,
    items: { select: { name: true, kind: true } },
    payments: { select: { status: true, amountKobo: true } },
    customer: { select: { displayName: true } },
  } satisfies Prisma.BookingSelect;
  const [customerCount, customers, bookingCount, upcoming, past] = await Promise.all([
    db.customer.count({ where: customerWhere }),
    db.customer.findMany({
      where: customerWhere,
      include: { phones: true, emails: true, _count: { select: { bookings: true } } },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take,
    }),
    db.booking.count({ where: bookingWhereQ }),
    db.booking.findMany({ where: { AND: [bookingWhereQ, { startAt: { gte: now } }] }, select: bookingSelect, orderBy: [{ startAt: "asc" }, { id: "asc" }], take }),
    db.booking.findMany({ where: { AND: [bookingWhereQ, { startAt: { lt: now } }] }, select: bookingSelect, orderBy: [{ startAt: "desc" }, { id: "asc" }], take }),
  ]);
  return {
    customerCount,
    bookingCount,
    customers: customers.map((c) => ({
      id: c.id,
      name: c.displayName,
      phone: c.phones[0]?.e164 ?? null,
      email: c.emails[0]?.value ?? null,
      bookingCount: c._count.bookings,
    })),
    bookings: [...upcoming, ...past].slice(0, take).map((b) => ({
      id: b.id,
      reference: b.reference,
      customerName: b.customer?.displayName ?? b.contactName,
      services: b.items.filter((i) => i.kind !== "extra").map((i) => i.name).join(", "),
      startAt: b.startAt.toISOString(),
      totalKobo: b.totalKobo,
      payment: paymentSummaryState(b, b.payments),
      status: b.status as BookingStatus,
    })),
  };
}
