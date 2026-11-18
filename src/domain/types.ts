/**
 * Domain shapes shared by server and client code.
 *
 * These are plain, serialisable objects (dates as ISO strings) so they can cross
 * the server/client boundary. The database rows behind them live in
 * prisma/schema.prisma; src/server/mappers.ts converts between the two.
 * Money is always integer kobo (₦1 = 100 kobo).
 */
import type { DepositRule } from "./deposit";
import type { CapacityByWeekday, MessageTemplates, SalonDetails, WeeklyHours } from "./settings";

export type Kobo = number;

export type BookingStatus = "pending_payment" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired" | "needs_attention";
export type BookingItemKind = "main" | "add_on" | "extra";
export type PaymentType = "deposit" | "balance_online" | "manual" | "adjustment";
export type PaymentMethod = "card" | "transfer" | "cash" | "other";
export type PaymentStatus = "success" | "failed";

export interface Service {
  id: string;
  name: string;
  description: string;
  priceKobo: Kobo;
  durationMinutes: number;
  bookableAlone: boolean;
  availableAsAddOn: boolean;
  /** Price and duration when sold as an add-on; null falls back to the main values. */
  addOnPriceKobo: Kobo | null;
  addOnDurationMinutes: number | null;
  active: boolean;
  sortOrder: number;
  /** Add-ons this service offers (when it is a main service). */
  addOnIds: string[];
}

/** One line of a booking. Price and duration are copied at the time, so later price changes never alter it. */
export interface BookingItem {
  id: string;
  serviceId: string | null;
  kind: BookingItemKind;
  name: string;
  priceKobo: Kobo;
  durationMinutes: number;
  note: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  /** Short human reference shown to customers, for example HC-7KQ2M. */
  reference: string;
  customerId: string;
  /** What the customer typed for this booking. Customer-facing pages show only these. */
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  holdExpiresAt: string | null;
  totalKobo: Kobo;
  depositDueKobo: Kobo;
  customerNote: string;
  /** Admin only. Never sent to customer-facing pages. */
  privateNote: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: BookingItem[];
}

/** A ledger row: money actually received (or a correction). Never edited. */
export interface Payment {
  id: string;
  bookingId: string;
  type: PaymentType;
  method: PaymentMethod;
  amountKobo: Kobo;
  status: PaymentStatus;
  paystackReference: string | null;
  recordedByName: string | null;
  note: string;
  createdAt: string;
}

export interface CustomerEmail {
  value: string;
  isPlaceholder: boolean;
  bounced: boolean;
}

export interface Customer {
  id: string;
  displayName: string;
  /** Admin only. */
  notes: string;
  tags: string[];
  marketingConsent: boolean;
  createdAt: string;
  phones: string[];
  emails: CustomerEmail[];
}

export interface AuditEvent {
  id: string;
  bookingId: string | null;
  customerId: string | null;
  action: string;
  actor: string;
  at: string;
  summary: string;
}

export interface AvailabilitySettings {
  timezone: string;
  weeklyHours: WeeklyHours;
  capacityByWeekday: CapacityByWeekday;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  holdMinutes: number;
  minimumLeadMinutes: number;
  bookingHorizonDays: number;
}

export interface Settings {
  availability: AvailabilitySettings;
  deposit: DepositRule;
  messageTemplates: MessageTemplates;
  salonDetails: SalonDetails;
  schedulerHeartbeat: string | null;
}
