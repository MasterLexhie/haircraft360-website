"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { checkDemoCredentials, clearSessionCookie, requireAdmin, setSessionCookie } from "@/server/auth";
import {
  BookingError,
  completeBooking,
  recordManualPayment,
  setBookingStatus,
  updateBookingNote,
  updateCustomerNote,
  updateSettings,
  upsertService,
  type Actor,
  type CompletionInput,
} from "@/server/booking-service";
import { parseNairaToKobo } from "@/lib/money";
import type { PaymentMethod } from "@/domain/types";
import { capacityByWeekdaySchema, weeklyHoursSchema, type CapacityByWeekday, type WeekdayKey, type WeeklyHours } from "@/domain/settings";

export type ActionState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; link?: string } | null;

function fail(err: unknown): ActionState {
  if (err instanceof BookingError) return { error: err.message };
  throw err;
}

/** Every admin action starts here: the permission check runs inside the action, not only in proxy.ts. */
async function adminActor(): Promise<Actor> {
  const admin = await requireAdmin();
  return { id: null, label: admin.name };
}

/* ───────────── Auth (replaced in Milestone 2) ───────────── */

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
  const actor = await adminActor();
  const fieldErrors: Record<string, string> = {};
  const extras: CompletionInput["extras"] = [];
  const names = formData.getAll("extraName");
  names.forEach((n, i) => {
    const name = String(n).trim();
    const raw = String(formData.getAll("extraPrice")[i] ?? "");
    if (!name && !raw.trim()) return;
    const price = parseNairaToKobo(raw);
    if (!name) fieldErrors[`extra_${i}`] = "Name the extra service or product.";
    else if (price === null) fieldErrors[`extra_${i}`] = `Enter a price for “${name}”.`;
    else extras.push({ name, priceKobo: price, note: String(formData.getAll("extraNote")[i] ?? "") });
  });
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  try {
    const { balanceDueKobo } = await completeBooking(bookingId, { extras }, actor);
    refresh();
    return { ok: true, message: balanceDueKobo > 0 ? "Saved. A balance is still due." : "Saved. Nothing is outstanding." };
  } catch (e) {
    return fail(e);
  }
}

export async function setStatusAction(bookingId: string, status: "cancelled" | "no_show" | "confirmed"): Promise<ActionState> {
  const actor = await adminActor();
  try {
    await setBookingStatus(bookingId, status, actor);
    refresh();
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function bookingNoteAction(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  try {
    await updateBookingNote(bookingId, String(formData.get("privateNote") ?? ""), actor);
    refresh();
    return { ok: true, message: "Private note saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function customerNoteAction(customerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  try {
    await updateCustomerNote(customerId, String(formData.get("privateNotes") ?? ""), actor);
    refresh();
    return { ok: true, message: "Private note saved." };
  } catch (e) {
    return fail(e);
  }
}

const METHODS: PaymentMethod[] = ["cash", "transfer", "card", "other"];

export async function manualPaymentAction(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const amount = parseNairaToKobo(String(formData.get("amount") ?? ""));
  if (amount === null || amount <= 0) return { error: "Enter the amount received, for example 5000.", fieldErrors: { amount: "Enter an amount above ₦0." } };
  const method = String(formData.get("method") ?? "") as PaymentMethod;
  if (!METHODS.includes(method)) return { error: "Choose how the payment was received.", fieldErrors: { method: "Choose a method." } };
  try {
    await recordManualPayment(
      bookingId,
      { amountKobo: amount, method, note: String(formData.get("note") ?? ""), towardsDeposit: formData.get("purpose") === "deposit" },
      actor,
    );
    refresh();
    return { ok: true, message: "Payment recorded." };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────── Settings ───────────── */

export async function serviceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const name = String(formData.get("name") ?? "").trim();
  const price = parseNairaToKobo(String(formData.get("price") ?? ""));
  const duration = Number(formData.get("duration"));
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Give the service a name.";
  if (price === null) fieldErrors.price = "Enter a price, for example 15000.";
  if (!Number.isInteger(duration) || duration < 15 || duration > 600 || duration % 15) {
    fieldErrors.duration = "Use minutes in steps of 15, from 15 to 600.";
  }
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };
  try {
    await upsertService(
      {
        id: String(formData.get("id") ?? "") || null,
        name,
        description: String(formData.get("description") ?? "").trim().slice(0, 500),
        active: formData.get("active") === "on",
        priceKobo: price!,
        durationMinutes: duration,
      },
      actor,
    );
    refresh();
    return { ok: true, message: `Saved “${name}”. Existing bookings keep their original prices.` };
  } catch (e) {
    return fail(e);
  }
}

const DAYS: WeekdayKey[] = ["0", "1", "2", "3", "4", "5", "6"];

export async function settingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const num = (k: string) => Number(formData.get(k));
  const fieldErrors: Record<string, string> = {};

  const hoursDraft: Record<string, unknown> = {};
  const capacityDraft: Record<string, number> = {};
  for (const d of DAYS) {
    const closed = formData.get(`closed_${d}`) === "on";
    hoursDraft[d] = closed ? null : { open: String(formData.get(`open_${d}`) ?? ""), close: String(formData.get(`close_${d}`) ?? "") };
    capacityDraft[d] = closed ? 0 : num(`capacity_${d}`);
  }
  const hours = weeklyHoursSchema.safeParse(hoursDraft);
  if (!hours.success) {
    for (const issue of hours.error.issues) fieldErrors[`day_${String(issue.path[0])}`] = "Use HH:MM, with opening before closing.";
  }
  const capacity = capacityByWeekdaySchema.safeParse(capacityDraft);
  if (!capacity.success) {
    for (const issue of capacity.error.issues) fieldErrors[`capacity_${String(issue.path[0])}`] = "Enter a whole number from 0 to 20.";
  }

  const checks: [string, number, number, number][] = [
    ["slotIntervalMinutes", num("slotIntervalMinutes"), 15, 120],
    ["bufferMinutes", num("bufferMinutes"), 0, 120],
    ["bookingHorizonDays", num("bookingHorizonDays"), 1, 180],
    ["holdMinutes", num("holdMinutes"), 5, 120],
    ["minimumLeadMinutes", num("minimumLeadMinutes"), 0, 2880],
    ["depositPercent", num("depositPercent"), 0, 100],
  ];
  for (const [k, v, min, max] of checks) {
    if (!Number.isInteger(v) || v < min || v > max) fieldErrors[k] = `Enter a whole number from ${min} to ${max}.`;
  }
  const minimumRaw = String(formData.get("depositMinimum") ?? "").trim();
  const minimumKobo = minimumRaw === "" ? null : parseNairaToKobo(minimumRaw);
  const fixedKobo = parseNairaToKobo(String(formData.get("depositFixed") ?? ""));
  if (minimumRaw !== "" && minimumKobo === null) fieldErrors.depositMinimum = "Enter an amount, for example 2000, or leave blank for no minimum.";
  if (fixedKobo === null) fieldErrors.depositFixed = "Enter an amount, for example 5000.";
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  try {
    await updateSettings(
      {
        availability: {
          timezone: "Africa/Lagos",
          weeklyHours: hours.data as WeeklyHours,
          capacityByWeekday: capacity.data as CapacityByWeekday,
          slotIntervalMinutes: num("slotIntervalMinutes"),
          bufferMinutes: num("bufferMinutes"),
          bookingHorizonDays: num("bookingHorizonDays"),
          holdMinutes: num("holdMinutes"),
          minimumLeadMinutes: num("minimumLeadMinutes"),
        },
        deposit: {
          type: formData.get("depositType") === "fixed" ? "fixed" : "percent",
          percent: num("depositPercent"),
          fixedKobo: fixedKobo!,
          scope: formData.get("depositScope") === "main_only" ? "main_only" : "full_total",
          minimumKobo,
        },
      },
      actor,
    );
    refresh();
    return { ok: true, message: "Settings saved. New bookings use these values; existing bookings are unchanged." };
  } catch (e) {
    return fail(e);
  }
}
