import type { BookingStatus, PaymentPurpose, PaymentState } from "./types";
import type { PaymentSummaryState } from "./pricing";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

/** Status names are a planning default — final names need owner confirmation (PRD §6). */
export const bookingStatusLabel: Record<BookingStatus, { label: string; tone: Tone; help: string }> = {
  awaiting_deposit: { label: "Awaiting deposit", tone: "warning", help: "Slot held until the demo deposit is paid or the hold ends." },
  confirmed: { label: "Confirmed", tone: "success", help: "Deposit paid. Appointment is booked." },
  completed: { label: "Completed", tone: "info", help: "Service recorded by the salon." },
  cancelled: { label: "Cancelled", tone: "neutral", help: "Cancelled by the salon." },
  no_show: { label: "No-show", tone: "danger", help: "Marked as a no-show by the salon." },
  expired: { label: "Hold expired", tone: "neutral", help: "Deposit was not completed in time, so the slot was released." },
};

export const paymentStateLabel: Record<PaymentState, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  success: { label: "Successful", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  abandoned: { label: "Expired", tone: "neutral" },
};

export const paymentPurposeLabel: Record<PaymentPurpose, string> = {
  deposit: "Deposit",
  balance: "Balance",
  manual: "Manual entry",
};

export const paymentSummaryLabel: Record<PaymentSummaryState, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "warning" },
  deposit_paid: { label: "Deposit paid", tone: "info" },
  balance_due: { label: "Balance due", tone: "danger" },
  paid_in_full: { label: "Paid in full", tone: "success" },
};
