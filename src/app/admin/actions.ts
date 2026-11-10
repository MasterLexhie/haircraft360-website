"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { checkDemoCredentials, clearSessionCookie, requireAdmin, setSessionCookie } from "@/server/auth";
import {
  BookingError,
  recordCompletion,
  recordManualPayment,
  setBookingStatus,
  startCheckout,
  toggleChecklistItem,
  updateBookingNotes,
  updateCustomerNotes,
  updateSettings,
  upsertService,
  type CompletionInput,
} from "@/server/booking-service";
import { resetDatabase, readDb } from "@/server/store";
import { parseNairaToKobo } from "@/lib/money";
import type { DayKey, DayHours } from "@/domain/types";

export type ActionState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; link?: string } | null;

function fail(err: unknown): ActionState {
  if (err instanceof BookingError) return { error: err.message };
  throw err;
}

/* ───────────── Auth ───────────── */

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!checkDemoCredentials(email, password)) {
    return { error: "That email and password don't match the demo owner account." };
  }
  await setSessionCookie();
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/admin/login");
}

/* ───────────── Bookings ───────────── */

export async function completeBookingAction(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const lineIds = formData.getAll("lineId").map(String);
  const fieldErrors: Record<string, string> = {};

  const lines: CompletionInput["lines"] = lineIds.map((id) => {
    const delivered = formData.get(`delivered_${id}`) === "on";
    const raw = String(formData.get(`price_${id}`) ?? "");
    const price = raw.trim() === "" ? null : parseNairaToKobo(raw);
    if (delivered && raw.trim() !== "" && price === null) fieldErrors[`price_${id}`] = "Enter a valid amount, e.g. 15000";
    return { id, delivered, actualPriceKobo: price, addOnNote: String(formData.get(`note_${id}`) ?? "") };
  });

  const extras: CompletionInput["extras"] = [];
  formData.getAll("extraName").forEach((n, i) => {
    const name = String(n).trim();
    const raw = String(formData.getAll("extraPrice")[i] ?? "");
    if (!name && !raw.trim()) return;
    const price = parseNairaToKobo(raw);
    if (!name) fieldErrors[`extra_${i}`] = "Name the extra service or product.";
    else if (price === null) fieldErrors[`extra_${i}`] = `Enter a price for “${name}”.`;
    else extras.push({ name, priceKobo: price, note: String(formData.getAll("extraNote")[i] ?? "") });
  });

  const total = parseNairaToKobo(String(formData.get("actualTotal") ?? ""));
  if (total === null) fieldErrors.actualTotal = "Enter the actual total charged, e.g. 18000";
  const completionNote = String(formData.get("completionNote") ?? "");
  const estimate = Number(formData.get("estimateKobo"));
  if (total !== null && total !== estimate && completionNote.trim().length < 3) {
    fieldErrors.completionNote = "The total differs from the estimate — add a short note explaining the extras or adjustment.";
  }
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  try {
    const { balanceDueKobo } = recordCompletion(bookingId, { lines, extras, actualTotalKobo: total!, completionNote });
    refresh();
    return { ok: true, message: balanceDueKobo > 0 ? "Completion saved. Balance updated — share the payment link with the customer." : "Completion saved. Nothing is outstanding." };
  } catch (e) {
    return fail(e);
  }
}

export async function setStatusAction(bookingId: string, status: "cancelled" | "no_show" | "confirmed"): Promise<ActionState> {
  await requireAdmin();
  try {
    setBookingStatus(bookingId, status);
    refresh();
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function bookingNoteAction(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  updateBookingNotes(bookingId, String(formData.get("privateNote") ?? ""));
  refresh();
  return { ok: true, message: "Private note saved." };
}

export async function customerNoteAction(customerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    updateCustomerNotes(customerId, String(formData.get("privateNotes") ?? ""));
    refresh();
    return { ok: true, message: "Private note saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function manualPaymentAction(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const amount = parseNairaToKobo(String(formData.get("amount") ?? ""));
  if (amount === null || amount <= 0) return { error: "Enter the amount received, e.g. 5000.", fieldErrors: { amount: "Enter an amount above ₦0." } };
  try {
    recordManualPayment(bookingId, {
      amountKobo: amount,
      method: String(formData.get("method") ?? ""),
      note: String(formData.get("note") ?? ""),
      purpose: formData.get("purpose") === "deposit" ? "deposit" : "balance",
    });
    refresh();
    return { ok: true, message: "Manual payment recorded." };
  } catch (e) {
    return fail(e);
  }
}

/** Creates (or reuses) a balance checkout and returns the customer-facing link. */
export async function balanceLinkAction(bookingId: string): Promise<ActionState> {
  await requireAdmin();
  const b = readDb().bookings.find((x) => x.id === bookingId);
  if (!b) return { error: "Booking not found." };
  try {
    startCheckout(b.reference, null, "balance", "Owner (demo admin)");
    refresh();
    return { ok: true, message: "Payment link ready.", link: `/booking/${b.reference}?t=${encodeURIComponent(b.accessToken)}` };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────── Settings ───────────── */

export async function serviceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const durRaw = String(formData.get("duration") ?? "").trim();
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Give the service a name.";
  const price = priceRaw === "" ? null : parseNairaToKobo(priceRaw);
  if (priceRaw !== "" && price === null) fieldErrors.price = "Enter a price like 15000, or leave blank for “confirmed at appointment”.";
  const duration = durRaw === "" ? null : Number(durRaw);
  if (duration !== null && (!Number.isInteger(duration) || duration < 15 || duration > 600 || duration % 15)) {
    fieldErrors.duration = "Use minutes in steps of 15 (15–600), or leave blank.";
  }
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };
  upsertService({
    id: String(formData.get("id") ?? ""),
    name,
    description: String(formData.get("description") ?? "").trim(),
    active: formData.get("active") === "on",
    status: "demo", // only the owner can approve; the prototype keeps everything demo
    priceKobo: price,
    durationMinutes: duration,
  });
  refresh();
  return { ok: true, message: `Saved “${name}”. Existing bookings keep their original snapshot.` };
}

export async function settingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const num = (k: string) => Number(formData.get(k));
  const fieldErrors: Record<string, string> = {};
  const weeklyHours = {} as Record<DayKey, DayHours | null>;
  for (const d of [0, 1, 2, 3, 4, 5, 6] as DayKey[]) {
    const open = String(formData.get(`open_${d}`) ?? "");
    const close = String(formData.get(`close_${d}`) ?? "");
    if (formData.get(`closed_${d}`) === "on") weeklyHours[d] = null;
    else if (!open || !close || open >= close) fieldErrors[`day_${d}`] = "Opening time must be before closing time.";
    else weeklyHours[d] = { open, close };
  }
  const checks: [string, number, number, number][] = [
    ["slotStepMinutes", num("slotStepMinutes"), 15, 120],
    ["bookingHorizonDays", num("bookingHorizonDays"), 1, 180],
    ["pendingHoldMinutes", num("pendingHoldMinutes"), 5, 120],
    ["minimumLeadMinutes", num("minimumLeadMinutes"), 0, 2880],
    ["defaultDurationMinutes", num("defaultDurationMinutes"), 15, 600],
    ["concurrentCapacity", num("concurrentCapacity"), 1, 10],
    ["depositPercent", num("depositPercent"), 0, 100],
  ];
  for (const [k, v, min, max] of checks) {
    if (!Number.isInteger(v) || v < min || v > max) fieldErrors[k] = `Enter a whole number from ${min} to ${max}.`;
  }
  const minimumKobo = parseNairaToKobo(String(formData.get("depositMinimum") ?? ""));
  const fixedKobo = parseNairaToKobo(String(formData.get("depositFixed") ?? ""));
  if (minimumKobo === null) fieldErrors.depositMinimum = "Enter an amount, e.g. 2000.";
  if (fixedKobo === null) fieldErrors.depositFixed = "Enter an amount, e.g. 5000.";
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  updateSettings({
    availability: {
      timezone: "Africa/Lagos",
      weeklyHours,
      slotStepMinutes: num("slotStepMinutes"),
      bookingHorizonDays: num("bookingHorizonDays"),
      pendingHoldMinutes: num("pendingHoldMinutes"),
      minimumLeadMinutes: num("minimumLeadMinutes"),
      defaultDurationMinutes: num("defaultDurationMinutes"),
      concurrentCapacity: num("concurrentCapacity"),
    },
    deposit: {
      type: formData.get("depositType") === "fixed" ? "fixed" : "percent",
      percent: num("depositPercent"),
      minimumKobo: minimumKobo!,
      fixedKobo: fixedKobo!,
    },
  });
  refresh();
  return { ok: true, message: "Settings saved. New bookings use these demo values; existing bookings are unchanged." };
}

export async function checklistAction(id: string, done: boolean) {
  await requireAdmin();
  toggleChecklistItem(id, done);
  refresh();
}

export async function resetDemoAction() {
  await requireAdmin();
  resetDatabase();
  redirect("/admin");
}
