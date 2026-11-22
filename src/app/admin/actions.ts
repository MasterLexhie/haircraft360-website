"use server";

import { refresh } from "next/cache";
import { sendDueSoon } from "@/server/send-soon";
import { requireAdmin } from "@/server/auth";
import {
  BookingError,
  completeBooking,
  createBlock,
  deleteBlock,
  moveBooking,
  recordManualPayment,
  setBookingStatus,
  setMarketingConsent,
  updateBookingEmail,
  updateBookingNote,
  updateCustomerNote,
  updateCustomerTags,
  updateSettings,
  upsertService,
  type Actor,
  type CompletionInput,
} from "@/server/booking-service";
import { createBalanceLink } from "@/server/payments/links";
import { searchAdmin, type AdminSearch } from "@/server/admin-queries";
import { balanceLinkWhatsapp, markWhatsappSent } from "@/server/whatsapp-messages";
import { createExpense, saveExpenseCategory, softDeleteExpense, updateExpense } from "@/server/expenses";
import { unknownPlaceholders } from "@/domain/messages";
import { validateProgram } from "@/domain/academy";
import { saveProgram, setApplicationStatus, updateApplicationNote } from "@/server/academy";
import { normalizePhone } from "@/domain/phone";
import { parseNairaToKobo } from "@/lib/money";
import { addDays, isValidDateKey, lagosToUtcMs, parseHHMM } from "@/lib/time";
import { recordId } from "@/domain/schemas";
import { z } from "zod";
import type { PaymentMethod } from "@/domain/types";
import { capacityByWeekdaySchema, parseSalonDetailsInput, parseTemplatesInput, weeklyHoursSchema, type CapacityByWeekday, type WeekdayKey, type WeeklyHours } from "@/domain/settings";

export type ActionState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; link?: string; whatsappUrl?: string; sendVia?: "whatsapp" | "sms" } | null;

function fail(err: unknown): ActionState {
  if (err instanceof BookingError) return { error: err.message, fieldErrors: err.fieldErrors };
  throw err;
}

/** IDs arrive from the browser, so they are checked like any other input. */
function validId(value: unknown): string | null {
  const parsed = recordId.safeParse(value);
  return parsed.success ? parsed.data : null;
}
const INVALID: ActionState = { error: "That record couldn't be found. Reload the page and try again." };
const statusSchema = z.enum(["cancelled", "no_show", "confirmed"]);

/** Every admin action starts here: the permission check runs inside the action, not only in proxy.ts. */
async function adminActor(): Promise<Actor> {
  const admin = await requireAdmin();
  return { id: admin.id, label: admin.name };
}

/* ───────────── Bookings ───────────── */

export async function completeBookingAction(bookingIdRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const bookingId = validId(bookingIdRaw);
  if (!bookingId) return INVALID;
  const fieldErrors: Record<string, string> = {};
  const extras: CompletionInput["extras"] = [];
  const names = formData.getAll("extraName");
  if (names.length > 20) return { error: "Add at most 20 items at a time." };
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

export async function setStatusAction(bookingIdRaw: string, statusRaw: "cancelled" | "no_show" | "confirmed"): Promise<ActionState> {
  const actor = await adminActor();
  const bookingId = validId(bookingIdRaw);
  const status = statusSchema.safeParse(statusRaw);
  if (!bookingId || !status.success) return INVALID;
  try {
    await setBookingStatus(bookingId, status.data, actor);
    refresh();
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function moveBookingAction(bookingIdRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const bookingId = validId(bookingIdRaw);
  if (!bookingId) return INVALID;
  const startAt = z.iso.datetime().safeParse(formData.get("startAt"));
  if (!startAt.success) return { error: "Choose one of the free times." };
  try {
    const { confirmedByMove } = await moveBooking(bookingId, startAt.data, actor);
    refresh();
    return { ok: true, message: confirmedByMove ? "Booking moved and confirmed. Let the customer know their new time." : "Booking moved. Let the customer know their new time." };
  } catch (e) {
    return fail(e);
  }
}

export async function bookingNoteAction(bookingIdRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const bookingId = validId(bookingIdRaw);
  if (!bookingId) return INVALID;
  try {
    await updateBookingNote(bookingId, String(formData.get("privateNote") ?? ""), actor);
    refresh();
    return { ok: true, message: "Private note saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function customerNoteAction(customerIdRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const customerId = validId(customerIdRaw);
  if (!customerId) return INVALID;
  try {
    await updateCustomerNote(customerId, String(formData.get("privateNotes") ?? ""), actor);
    refresh();
    return { ok: true, message: "Private note saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function customerTagsAction(customerIdRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const customerId = validId(customerIdRaw);
  if (!customerId) return INVALID;
  try {
    await updateCustomerTags(customerId, formData.getAll("tag").map(String), actor);
    refresh();
    return { ok: true, message: "Tags saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function marketingConsentAction(customerIdRaw: string, consent: boolean): Promise<ActionState> {
  const actor = await adminActor();
  const customerId = validId(customerIdRaw);
  if (!customerId || typeof consent !== "boolean") return INVALID;
  try {
    await setMarketingConsent(customerId, consent, actor);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const METHODS: PaymentMethod[] = ["cash", "transfer", "card", "other"];

export async function manualPaymentAction(bookingIdRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const bookingId = validId(bookingIdRaw);
  if (!bookingId) return INVALID;
  const purposeRaw = String(formData.get("purpose") ?? "balance");
  const purpose = purposeRaw === "deposit" || purposeRaw === "correction" ? purposeRaw : "balance";
  const amountRaw = String(formData.get("amount") ?? "").trim();
  // A correction may take money off (a leading minus); payments are always positive.
  const negative = purpose === "correction" && /^[-−]/.test(amountRaw);
  const parsed = parseNairaToKobo(amountRaw.replace(/^[-−]/, ""));
  if (parsed === null || parsed <= 0) {
    return purpose === "correction"
      ? { error: "Enter the correction, for example -5000 to take ₦5,000 off.", fieldErrors: { amount: "Enter an amount, with - in front to take money off." } }
      : { error: "Enter the amount received, for example 5000.", fieldErrors: { amount: "Enter an amount above ₦0." } };
  }
  const note = String(formData.get("note") ?? "");
  if (purpose === "correction" && !note.trim()) return { error: "Say why this correction is needed.", fieldErrors: { note: "Required for a correction." } };
  const method = String(formData.get("method") ?? "") as PaymentMethod;
  if (!METHODS.includes(method)) return { error: "Choose how the payment was received.", fieldErrors: { method: "Choose a method." } };
  try {
    await recordManualPayment(bookingId, { amountKobo: negative ? -parsed : parsed, method, note, purpose }, actor);
    sendDueSoon();
    refresh();
    return { ok: true, message: purpose === "correction" ? "Correction recorded." : "Payment recorded." };
  } catch (e) {
    return fail(e);
  }
}

/** A fresh balance link for the owner to send. The link itself is shown once, here. */
export async function balanceLinkAction(bookingIdRaw: string): Promise<ActionState> {
  const actor = await adminActor();
  const bookingId = validId(bookingIdRaw);
  if (!bookingId) return INVALID;
  try {
    const { url } = await createBalanceLink(bookingId, actor);
    const send = await balanceLinkWhatsapp(bookingId, url);
    refresh();
    const how = send.via === "whatsapp" ? "on WhatsApp" : "by text message (they're not on WhatsApp)";
    return { ok: true, message: `Link ready. Send it ${how}, or copy it.`, link: url, whatsappUrl: send.url, sendVia: send.via };
  } catch (e) {
    return fail(e);
  }
}

/** A wrong or missing email fixed on the booking page; its failed messages are sent again. */
export async function bookingEmailAction(bookingIdRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const bookingId = validId(bookingIdRaw);
  if (!bookingId) return INVALID;
  try {
    const { resent } = await updateBookingEmail(bookingId, String(formData.get("email") ?? "").slice(0, 200), actor);
    refresh();
    return { ok: true, message: resent ? `Email saved. ${resent === 1 ? "The message goes" : "Its messages go"} out at the next scheduler run.` : "Email saved." };
  } catch (e) {
    return fail(e);
  }
}

/** The owner marked a WhatsApp confirmation or reminder as sent: take it off Reminders due. */
export async function whatsappSentAction(notificationIdRaw: string): Promise<ActionState> {
  const actor = await adminActor();
  const id = validId(notificationIdRaw);
  if (!id) return INVALID;
  try {
    await markWhatsappSent(id, actor);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────── Expenses ───────────── */

/** Adds an expense, or saves changes to one when an ID is given. */
export async function expenseSaveAction(expenseIdRaw: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const expenseId = expenseIdRaw === null ? null : validId(expenseIdRaw);
  if (expenseIdRaw !== null && !expenseId) return INVALID;
  const amount = parseNairaToKobo(String(formData.get("amount") ?? ""));
  if (amount === null || amount <= 0) return { error: "Enter the amount, for example 5000.", fieldErrors: { amount: "Enter an amount above ₦0." } };
  const input = {
    dateKey: String(formData.get("date") ?? ""),
    amountKobo: amount,
    categoryId: String(formData.get("category") ?? ""),
    method: String(formData.get("method") ?? "") as PaymentMethod,
    note: String(formData.get("note") ?? ""),
  };
  try {
    if (expenseId) await updateExpense(expenseId, input, actor);
    else await createExpense(input, actor);
    refresh();
    return { ok: true, message: expenseId ? "Expense saved." : "Expense added." };
  } catch (e) {
    return fail(e);
  }
}

export async function expenseDeleteAction(expenseIdRaw: string): Promise<ActionState> {
  const actor = await adminActor();
  const expenseId = validId(expenseIdRaw);
  if (!expenseId) return INVALID;
  try {
    await softDeleteExpense(expenseId, actor);
    refresh();
    return { ok: true, message: "Expense deleted." };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────── Settings ───────────── */

const minutesInRange = (v: number, min: number) => Number.isInteger(v) && v >= min && v <= 600 && v % 15 === 0;

export async function serviceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const price = parseNairaToKobo(String(formData.get("price") ?? ""));
  const duration = Number(formData.get("duration"));
  const bookableAlone = formData.get("bookableAlone") === "on";
  const availableAsAddOn = formData.get("availableAsAddOn") === "on";
  const addOnPriceRaw = String(formData.get("addOnPrice") ?? "").trim();
  const addOnDurationRaw = String(formData.get("addOnDuration") ?? "").trim();
  const addOnPrice = addOnPriceRaw === "" ? null : parseNairaToKobo(addOnPriceRaw);
  const addOnDuration = addOnDurationRaw === "" ? null : Number(addOnDurationRaw);
  const addOnIds = formData.getAll("addOnIds").map(validId);

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Give the service a name.";
  if (price === null) fieldErrors.price = "Enter a price, for example 15000.";
  if (!minutesInRange(duration, 15)) fieldErrors.duration = "Use minutes in steps of 15, from 15 to 600.";
  if (!bookableAlone && !availableAsAddOn) fieldErrors.offeredAs = "Choose at least one.";
  if (availableAsAddOn && addOnPriceRaw !== "" && addOnPrice === null) fieldErrors.addOnPrice = "Enter a price, or leave blank to use the main price.";
  if (availableAsAddOn && addOnDuration !== null && !minutesInRange(addOnDuration, 0)) fieldErrors.addOnDuration = "Use minutes in steps of 15, from 0 to 600, or leave blank.";
  if (addOnIds.length > 50 || addOnIds.some((id) => id === null)) return INVALID;
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };
  try {
    await upsertService(
      {
        id: validId(formData.get("id")),
        name,
        description: String(formData.get("description") ?? "").trim().slice(0, 500),
        active: formData.get("active") === "on",
        priceKobo: price!,
        durationMinutes: duration,
        bookableAlone,
        availableAsAddOn,
        addOnPriceKobo: addOnPrice,
        addOnDurationMinutes: addOnDuration,
        addOnIds: addOnIds as string[],
      },
      actor,
    );
    refresh();
    return { ok: true, message: `Saved “${name}”. Existing bookings keep their original prices.` };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────── Closures (Blocks) ───────────── */

const hhmmPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function blockAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "") || startDate;
  const wholeDay = formData.get("wholeDay") === "on";
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const mode = formData.get("mode") === "reduce" ? "reduce" : "close";
  const reduceBy = Number(formData.get("reduceBy"));

  const fieldErrors: Record<string, string> = {};
  if (!isValidDateKey(startDate)) fieldErrors.startDate = "Choose the first day.";
  if (!isValidDateKey(endDate) || endDate < startDate) fieldErrors.endDate = "Choose a last day on or after the first day.";
  if (!wholeDay && !hhmmPattern.test(from)) fieldErrors.from = "Choose a start time.";
  if (!wholeDay && !hhmmPattern.test(to)) fieldErrors.to = "Choose an end time.";
  if (mode === "reduce" && (!Number.isInteger(reduceBy) || reduceBy < 1 || reduceBy > 20)) fieldErrors.reduceBy = "Enter a whole number from 1 to 20.";
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  const startAt = new Date(lagosToUtcMs(startDate, wholeDay ? 0 : parseHHMM(from)));
  const endAt = new Date(wholeDay ? lagosToUtcMs(addDays(endDate, 1), 0) : lagosToUtcMs(endDate, parseHHMM(to)));
  try {
    const { affectedBookings } = await createBlock(
      { startAt, endAt, capacityReduction: mode === "reduce" ? reduceBy : null, reason: String(formData.get("reason") ?? "") },
      actor,
    );
    refresh();
    return {
      ok: true,
      message: affectedBookings
        ? `Saved. ${affectedBookings} existing booking${affectedBookings === 1 ? " is" : "s are"} in this period and still stand; contact them if they need to move.`
        : "Saved. Those times are no longer offered online.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBlockAction(blockIdRaw: string): Promise<ActionState> {
  const actor = await adminActor();
  const blockId = validId(blockIdRaw);
  if (!blockId) return INVALID;
  try {
    await deleteBlock(blockId, actor);
    refresh();
    return { ok: true, message: "Closure removed. Those times are bookable again." };
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

/* ───────────── Settings: message wording, salon details, expense categories ───────────── */

function formStrings(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v.slice(0, 4000);
  return out;
}

export async function templatesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const parsed = parseTemplatesInput(formStrings(formData), unknownPlaceholders);
  if (!parsed.ok) return { error: "Please fix the highlighted messages.", fieldErrors: parsed.fieldErrors };
  await updateSettings({ messageTemplates: parsed.value }, actor);
  refresh();
  return { ok: true, message: "Messages saved. New messages use this wording." };
}

export async function salonDetailsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const parsed = parseSalonDetailsInput(formStrings(formData), normalizePhone);
  if (!parsed.ok) return { error: "Please fix the highlighted fields.", fieldErrors: parsed.fieldErrors };
  await updateSettings({ salonDetails: parsed.value }, actor);
  refresh();
  return { ok: true, message: "Salon details saved." };
}

export async function expenseCategoryAction(categoryIdRaw: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const id = categoryIdRaw === null ? null : validId(categoryIdRaw);
  if (categoryIdRaw !== null && !id) return INVALID;
  try {
    await saveExpenseCategory({ id, name: String(formData.get("name") ?? "").slice(0, 200), active: id === null || formData.get("active") === "on" }, actor);
    refresh();
    return { ok: true, message: id ? "Category saved." : "Category added." };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────── Locs Mastery ───────────── */

const applicationStatusSchema = z.enum(["new", "contacted", "accepted", "declined", "withdrawn"]);

export async function applicationStatusAction(applicationIdRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const id = validId(applicationIdRaw);
  const status = applicationStatusSchema.safeParse(formData.get("status"));
  if (!id || !status.success) return INVALID;
  try {
    await setApplicationStatus(id, status.data, actor);
    refresh();
    return { ok: true, message: "Status saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function applicationNoteAction(applicationIdRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const id = validId(applicationIdRaw);
  if (!id) return INVALID;
  try {
    await updateApplicationNote(id, String(formData.get("privateNote") ?? ""), actor);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function programAction(programIdRaw: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const id = programIdRaw === null ? null : validId(programIdRaw);
  if (programIdRaw !== null && !id) return INVALID;
  const parsed = validateProgram(formStrings(formData));
  if (!parsed.ok) return { error: "Please fix the highlighted fields.", fieldErrors: parsed.fieldErrors };
  try {
    await saveProgram(id, parsed.value, actor);
    refresh();
    return { ok: true, message: id ? "Program saved." : "Program added." };
  } catch (e) {
    return fail(e);
  }
}

/** Live results for the admin search (top bar dropdown and the search screen). */
export async function searchAction(q: string, take: number): Promise<AdminSearch> {
  await requireAdmin();
  return searchAdmin(String(q).slice(0, 100), Math.min(Math.max(Math.trunc(take) || 5, 1), 30));
}
