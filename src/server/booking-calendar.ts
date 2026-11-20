import "server-only";
import type { Booking } from "@/domain/types";
import { business, fullAddress } from "@/config/business";
import { formatNaira } from "@/lib/money";
import type { CalendarEvent } from "@/lib/calendar";
import { siteUrl } from "./booking-access";

/**
 * The calendar entry for a booking, shared by the booking page, the .ics route and emails.
 * Salon name and address come from src/config/business.ts, like the booking page, until
 * Milestone 7 moves them to Settings.
 */
export function calendarEventFor(booking: Pick<Booking, "id" | "reference" | "startAt" | "endAt" | "updatedAt" | "items">, opts: { url?: string; balanceKobo?: number } = {}): CalendarEvent {
  const main = booking.items.find((i) => i.kind === "main") ?? booking.items[0];
  const services = booking.items.map((i) => i.name).join(", ");
  const description = [
    `Booking ${booking.reference}: ${services}.`,
    opts.balanceKobo !== undefined && opts.balanceKobo > 0 ? `Balance due at the salon: ${formatNaira(opts.balanceKobo)}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `${booking.id}@${new URL(siteUrl()).hostname}`,
    title: `${main?.name ?? "Appointment"} at ${business.brandName}`,
    startAt: booking.startAt,
    endAt: booking.endAt,
    location: fullAddress,
    description,
    url: opts.url,
    // Rises with every change, so a moved booking replaces the old entry.
    sequence: Math.floor(Date.parse(booking.updatedAt) / 1000),
  };
}
