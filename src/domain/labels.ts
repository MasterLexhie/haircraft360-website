import type { BookingStatus, PaymentMethod, PaymentType } from "./types";
import type { PaymentSummaryState } from "./pricing";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

/** Plain-language status labels. The owner sees these; never show raw status codes. */
export const bookingStatusLabel: Record<BookingStatus, { label: string; tone: Tone; help: string }> = {
  pending_payment: { label: "Awaiting deposit", tone: "warning", help: "The time is held while the customer pays the deposit." },
  confirmed: { label: "Confirmed", tone: "success", help: "Deposit paid. Appointment is booked." },
  completed: { label: "Completed", tone: "info", help: "The appointment has taken place." },
  cancelled: { label: "Cancelled", tone: "neutral", help: "Cancelled by the salon." },
  no_show: { label: "No-show", tone: "danger", help: "The customer did not come." },
  expired: { label: "Hold expired", tone: "neutral", help: "The deposit was not paid in time, so the time was released." },
  needs_attention: { label: "Needs a new time", tone: "danger", help: "Payment arrived after the time was taken. Move this booking to another time." },
};

export const paymentTypeLabel: Record<PaymentType, string> = {
  deposit: "Deposit",
  balance_online: "Balance (online)",
  manual: "Recorded by the salon",
  adjustment: "Correction",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  card: "Card",
  transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

export const paymentSummaryLabel: Record<PaymentSummaryState, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "warning" },
  deposit_paid: { label: "Deposit paid", tone: "info" },
  balance_due: { label: "Balance due", tone: "danger" },
  paid_in_full: { label: "Paid in full", tone: "success" },
};
