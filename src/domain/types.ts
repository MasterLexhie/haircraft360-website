/**
 * Core data model for the Haircraft360 prototype.
 *
 * Money is always integer kobo (₦1 = 100 kobo). Timestamps are ISO-8601 UTC
 * strings; the UI renders them in the salon timezone (Africa/Lagos).
 */

export type Kobo = number;

/** "demo" = sample data for the prototype; "approved" = confirmed by the owner. */
export type ApprovalStatus = "demo" | "approved";

export interface Service {
  id: string;
  name: string;
  description: string;
  active: boolean;
  status: ApprovalStatus;
  /** null = price not configured ("confirmed at appointment"). */
  priceKobo: Kobo | null;
  /** null = duration not configured; availability falls back to the default block. */
  durationMinutes: number | null;
  sortOrder: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  /** Private to the admin area. Never sent to customer-facing pages. */
  privateNotes: string;
  isDemo: boolean;
}

export type BookingStatus =
  | "awaiting_deposit"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "expired";

/** Snapshot of a service as it was booked, plus what was actually delivered. */
export interface BookingServiceLine {
  id: string;
  /** null for extras added at completion. */
  serviceId: string | null;
  kind: "booked" | "extra";
  name: string;
  serviceStatus: ApprovalStatus;
  estimatedPriceKobo: Kobo | null;
  estimatedDurationMinutes: number;
  delivered: boolean;
  actualPriceKobo: Kobo | null;
  addOnNote: string;
}

export interface Booking {
  id: string;
  /** Short human reference shown to customers, e.g. HC-7KQ2M. */
  reference: string;
  /** Unguessable token for the customer's booking link (stands in for a signed link). */
  accessToken: string;
  customerId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  createdAt: string;
  /** While awaiting deposit, the slot is held until this time. */
  holdExpiresAt: string | null;
  estimatedTotalKobo: Kobo;
  hasUnpricedItems: boolean;
  depositDueKobo: Kobo;
  /** Set by the owner after the appointment. Kept separate from the estimate. */
  actualTotalKobo: Kobo | null;
  lines: BookingServiceLine[];
  /** Written by the customer when booking; visible to both sides. */
  customerNote: string;
  /** Owner's note on what changed (extras/products/adjustments). Visible to customer. */
  completionNote: string;
  /** Private admin note. Never sent to customer-facing pages. */
  privateNote: string;
  completedAt: string | null;
  isDemo: boolean;
}

export type PaymentPurpose = "deposit" | "balance" | "manual";
export type PaymentState = "pending" | "success" | "failed" | "abandoned";
export type PaymentSource = "mock_checkout" | "manual_entry";

export interface Payment {
  id: string;
  bookingId: string;
  customerId: string;
  amountKobo: Kobo;
  purpose: PaymentPurpose;
  state: PaymentState;
  source: PaymentSource;
  /** Unique reference; the idempotency key for checkout callbacks. */
  reference: string;
  createdAt: string;
  resolvedAt: string | null;
  /** Manual entries only: e.g. "Cash", "Bank transfer". */
  method: string | null;
  note: string;
  recordedBy: string | null;
  /** Always true in this prototype: no real money moves. */
  isDemo: true;
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

export type DayKey = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface DayHours {
  open: string; // "08:00"
  close: string; // "21:00"
}

export interface AvailabilityConfig {
  timezone: "Africa/Lagos";
  weeklyHours: Record<DayKey, DayHours | null>;
  slotStepMinutes: number;
  bookingHorizonDays: number;
  pendingHoldMinutes: number;
  minimumLeadMinutes: number;
  defaultDurationMinutes: number;
  /** How many appointments can overlap. 1 = a single chair / stylist. */
  concurrentCapacity: number;
}

export interface DepositRule {
  type: "percent" | "fixed";
  percent: number;
  fixedKobo: Kobo;
  minimumKobo: Kobo;
}

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  done: boolean;
}

export interface Settings {
  availability: AvailabilityConfig;
  deposit: DepositRule;
  /** Whether the hours/deposit/availability values are owner-approved. */
  availabilityStatus: ApprovalStatus;
  depositStatus: ApprovalStatus;
  checklist: ChecklistItem[];
}

export interface Database {
  version: number;
  seededAt: string;
  services: Service[];
  customers: Customer[];
  bookings: Booking[];
  payments: Payment[];
  audit: AuditEvent[];
  settings: Settings;
}
