import "server-only";
import type * as P from "@/generated/prisma/client";
import type { AuditEvent, Booking, BookingItem, Customer, Payment, Service, Settings } from "@/domain/types";
import { capacityByWeekdaySchema, messageTemplatesSchema, salonDetailsSchema, weeklyHoursSchema } from "@/domain/settings";

/**
 * Database rows -> plain domain objects (ISO date strings, no Prisma types),
 * safe to pass to client components.
 */

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

export function toService(row: P.Service & { addOns?: { addOnServiceId: string }[] }): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceKobo: row.priceKobo,
    durationMinutes: row.durationMinutes,
    bookableAlone: row.bookableAlone,
    availableAsAddOn: row.availableAsAddOn,
    addOnPriceKobo: row.addOnPriceKobo,
    addOnDurationMinutes: row.addOnDurationMinutes,
    active: row.active,
    sortOrder: row.sortOrder,
    addOnIds: row.addOns?.map((a) => a.addOnServiceId) ?? [],
  };
}

export function toBookingItem(row: P.BookingItem): BookingItem {
  return {
    id: row.id,
    serviceId: row.serviceId,
    kind: row.kind,
    name: row.name,
    priceKobo: row.priceKobo,
    durationMinutes: row.durationMinutes,
    note: row.note,
    createdAt: iso(row.createdAt),
  };
}

export function toBooking(row: P.Booking & { items: P.BookingItem[] }): Booking {
  return {
    id: row.id,
    reference: row.reference,
    customerId: row.customerId,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    startAt: iso(row.startAt),
    endAt: iso(row.endAt),
    status: row.status,
    holdExpiresAt: isoOrNull(row.holdExpiresAt),
    totalKobo: row.totalKobo,
    depositDueKobo: row.depositDueKobo,
    customerNote: row.customerNote,
    privateNote: row.privateNote,
    completedAt: isoOrNull(row.completedAt),
    cancelledAt: isoOrNull(row.cancelledAt),
    createdAt: iso(row.createdAt),
    items: [...row.items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || kindOrder[a.kind] - kindOrder[b.kind]).map(toBookingItem),
  };
}
const kindOrder: Record<P.BookingItem["kind"], number> = { main: 0, add_on: 1, extra: 2 };

export function toPayment(row: P.Payment & { recordedBy?: { displayName: string } | null }): Payment {
  return {
    id: row.id,
    bookingId: row.bookingId,
    type: row.type,
    method: row.method,
    amountKobo: row.amountKobo,
    status: row.status,
    paystackReference: row.paystackReference,
    recordedByName: row.recordedBy?.displayName ?? null,
    note: row.note,
    createdAt: iso(row.createdAt),
  };
}

export function toCustomer(row: P.Customer & { phones: P.CustomerPhone[]; emails: P.CustomerEmail[] }): Customer {
  return {
    id: row.id,
    displayName: row.displayName,
    notes: row.notes,
    tags: row.tags,
    marketingConsent: row.marketingConsent,
    createdAt: iso(row.createdAt),
    phones: row.phones.map((p) => p.e164),
    emails: row.emails.map((e) => ({ value: e.value, isPlaceholder: e.isPlaceholder, bounced: e.bouncedAt !== null })),
  };
}

export function toAuditEvent(row: P.AuditLog): AuditEvent {
  return {
    id: row.id,
    bookingId: row.bookingId,
    customerId: row.customerId,
    action: row.action,
    actor: row.actorLabel,
    at: iso(row.createdAt),
    summary: row.summary,
  };
}

/** Validates the JSON columns; a malformed row fails loudly instead of corrupting availability. */
export function toSettings(row: P.Settings): Settings {
  return {
    availability: {
      timezone: row.timezone,
      weeklyHours: weeklyHoursSchema.parse(row.weeklyHours),
      capacityByWeekday: capacityByWeekdaySchema.parse(row.capacityByWeekday),
      slotIntervalMinutes: row.slotIntervalMinutes,
      bufferMinutes: row.bufferMinutes,
      holdMinutes: row.holdMinutes,
      minimumLeadMinutes: row.minimumLeadMinutes,
      bookingHorizonDays: row.bookingHorizonDays,
    },
    deposit: {
      type: row.depositType,
      fixedKobo: row.depositFixedKobo,
      percent: row.depositPercent,
      scope: row.depositScope,
      minimumKobo: row.depositMinimumKobo,
    },
    messageTemplates: messageTemplatesSchema.parse(row.messageTemplates),
    salonDetails: salonDetailsSchema.parse(row.salonDetails),
    schedulerHeartbeat: isoOrNull(row.schedulerHeartbeat),
  };
}
