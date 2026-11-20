import "server-only";
import type { Kobo, PaymentMethod } from "@/domain/types";
import { paymentMethodLabel } from "@/domain/labels";
import { formatNaira, MAX_FORM_AMOUNT_KOBO } from "@/lib/money";
import { formatDateKey, isValidDateKey, lagosDateKey } from "@/lib/time";
import { db } from "./db";
import { audit } from "./audit";
import { BookingError, type Actor } from "./booking-service";

/**
 * Expenses (BUILD_SPEC 6.6): money out, entered by the owner. Never hard-deleted: a deleted
 * expense keeps its row (deletedAt) and every change is in the activity log.
 * `date` is a Lagos calendar day, stored as a plain date.
 */

export const EXPENSE_METHODS: PaymentMethod[] = ["cash", "transfer", "card", "other"];
const MAX_NOTE = 500;

export interface ExpenseInput {
  dateKey: string;
  amountKobo: Kobo;
  categoryId: string;
  method: PaymentMethod;
  note: string;
}

export interface ExpenseRow {
  id: string;
  dateKey: string;
  amountKobo: Kobo;
  categoryId: string;
  categoryName: string;
  method: PaymentMethod;
  note: string;
  createdByName: string | null;
  deletedAt: string | null;
}

const toDate = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`);
const toKey = (d: Date) => d.toISOString().slice(0, 10);

export async function activeExpenseCategories() {
  return db.expenseCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
}

async function checked(input: ExpenseInput, nowMs: number): Promise<{ categoryName: string; note: string }> {
  const fieldErrors: Record<string, string> = {};
  if (!isValidDateKey(input.dateKey)) fieldErrors.date = "Choose a date.";
  else if (input.dateKey > lagosDateKey(nowMs)) fieldErrors.date = "The date can't be in the future.";
  if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) fieldErrors.amount = "Enter an amount above ₦0.";
  else if (input.amountKobo > MAX_FORM_AMOUNT_KOBO) fieldErrors.amount = "That amount is too large. Check it.";
  if (!EXPENSE_METHODS.includes(input.method)) fieldErrors.method = "Choose how it was paid.";
  const note = input.note.trim();
  if (note.length > MAX_NOTE) fieldErrors.note = `Keep the note under ${MAX_NOTE} characters.`;
  const category = input.categoryId ? await db.expenseCategory.findUnique({ where: { id: input.categoryId } }) : null;
  if (!category || !category.active) fieldErrors.category = "Choose a category.";
  if (Object.keys(fieldErrors).length) throw new BookingError("VALIDATION", "Please check the expense.", fieldErrors);
  return { categoryName: category!.name, note };
}

const describe = (amountKobo: Kobo, categoryName: string, dateKey: string) => `${formatNaira(amountKobo)} for ${categoryName} on ${formatDateKey(dateKey)}`;

export async function createExpense(input: ExpenseInput, actor: Actor, nowMs = Date.now()): Promise<string> {
  const { categoryName, note } = await checked(input, nowMs);
  return db.$transaction(async (tx) => {
    const e = await tx.expense.create({
      data: { date: toDate(input.dateKey), amountKobo: input.amountKobo, categoryId: input.categoryId, method: input.method, note, createdById: actor.id },
    });
    await audit(tx, { action: "expense.created", actorLabel: actor.label, actorId: actor.id, entityType: "Expense", entityId: e.id, summary: `Expense added: ${describe(input.amountKobo, categoryName, input.dateKey)}` });
    return e.id;
  });
}

export async function updateExpense(id: string, input: ExpenseInput, actor: Actor, nowMs = Date.now()): Promise<void> {
  const { categoryName, note } = await checked(input, nowMs);
  await db.$transaction(async (tx) => {
    const before = await tx.expense.findUnique({ where: { id }, include: { category: true } });
    if (!before || before.deletedAt) throw new BookingError("NOT_FOUND", "That expense couldn't be found.");
    const changes = [
      toKey(before.date) !== input.dateKey ? `date from ${formatDateKey(toKey(before.date))} to ${formatDateKey(input.dateKey)}` : "",
      before.amountKobo !== input.amountKobo ? `amount from ${formatNaira(before.amountKobo)} to ${formatNaira(input.amountKobo)}` : "",
      before.categoryId !== input.categoryId ? `category from ${before.category.name} to ${categoryName}` : "",
      before.method !== input.method ? `paid by from ${paymentMethodLabel[before.method]} to ${paymentMethodLabel[input.method]}` : "",
      before.note !== note ? "note changed" : "",
    ].filter(Boolean);
    if (!changes.length) return;
    await tx.expense.update({ where: { id }, data: { date: toDate(input.dateKey), amountKobo: input.amountKobo, categoryId: input.categoryId, method: input.method, note } });
    await audit(tx, {
      action: "expense.updated",
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "Expense",
      entityId: id,
      summary: `Expense changed (${describe(input.amountKobo, categoryName, input.dateKey)}): ${changes.join("; ")}`,
    });
  });
}

/** Takes it out of the lists and totals; the row and its history stay. */
export async function softDeleteExpense(id: string, actor: Actor): Promise<void> {
  await db.$transaction(async (tx) => {
    const e = await tx.expense.findUnique({ where: { id }, include: { category: true } });
    if (!e) throw new BookingError("NOT_FOUND", "That expense couldn't be found.");
    if (e.deletedAt) return;
    await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit(tx, { action: "expense.deleted", actorLabel: actor.label, actorId: actor.id, entityType: "Expense", entityId: id, summary: `Expense deleted: ${describe(e.amountKobo, e.category.name, toKey(e.date))}` });
  });
}

function toRow(e: { id: string; date: Date; amountKobo: number; categoryId: string; category: { name: string }; method: PaymentMethod; note: string; createdBy: { displayName: string } | null; deletedAt: Date | null }): ExpenseRow {
  return {
    id: e.id,
    dateKey: toKey(e.date),
    amountKobo: e.amountKobo,
    categoryId: e.categoryId,
    categoryName: e.category.name,
    method: e.method,
    note: e.note,
    createdByName: e.createdBy?.displayName ?? null,
    deletedAt: e.deletedAt?.toISOString() ?? null,
  };
}

const include = { category: { select: { name: true } }, createdBy: { select: { displayName: true } } } as const;

/** Expenses in a period (Lagos days, inclusive), newest first. Deleted ones are left out. */
export async function listExpenses(opts: { fromKey: string; toKey: string; categoryId?: string }): Promise<{ rows: ExpenseRow[]; totalKobo: Kobo }> {
  const rows = await db.expense.findMany({
    where: { deletedAt: null, date: { gte: toDate(opts.fromKey), lte: toDate(opts.toKey) }, ...(opts.categoryId ? { categoryId: opts.categoryId } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include,
  });
  return { rows: rows.map(toRow), totalKobo: rows.reduce((s, r) => s + r.amountKobo, 0) };
}

export async function getExpense(id: string): Promise<ExpenseRow | null> {
  const e = await db.expense.findUnique({ where: { id }, include });
  return e ? toRow(e) : null;
}
