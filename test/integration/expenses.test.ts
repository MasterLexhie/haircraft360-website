import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "../db";
import { createSettings } from "../factories";
import { lagosDateKey, addDays } from "@/lib/time";
import { activeExpenseCategories, createExpense, listExpenseCategories, listExpenses, saveExpenseCategory, softDeleteExpense, updateExpense, type ExpenseInput } from "@/server/expenses";

const actor = { id: null, label: "Test admin" };
const today = lagosDateKey(Date.now());
let supplies: string;
let rent: string;
let retired: string;

beforeEach(async () => {
  await resetDatabase();
  await createSettings();
  supplies = (await db.expenseCategory.create({ data: { name: "Supplies", sortOrder: 0 } })).id;
  rent = (await db.expenseCategory.create({ data: { name: "Rent", sortOrder: 1 } })).id;
  retired = (await db.expenseCategory.create({ data: { name: "Old", sortOrder: 2, active: false } })).id;
});

const input = (overrides: Partial<ExpenseInput> = {}): ExpenseInput => ({ dateKey: today, amountKobo: 500_000, categoryId: supplies, method: "cash", note: "Shampoo", ...overrides });

describe("expenses", () => {
  it("adds, edits and soft-deletes, each in the activity log", async () => {
    const id = await createExpense(input(), actor);
    await updateExpense(id, input({ amountKobo: 650_000, categoryId: rent, note: "Shop rent" }), actor);
    await softDeleteExpense(id, actor);
    const row = await db.expense.findUniqueOrThrow({ where: { id } });
    expect(row.deletedAt).not.toBeNull();
    const logs = await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.action)).toEqual(["expense.created", "expense.updated", "expense.deleted"]);
    expect(logs[1]!.summary).toContain("amount from ₦5,000 to ₦6,500");
    expect(logs[1]!.summary).toContain("category from Supplies to Rent");
    expect(logs[1]!.summary).toContain("note changed");
    expect(logs.every((l) => l.actorLabel === "Test admin")).toBe(true);
  });

  it("logs nothing when an edit changes nothing, and won't edit a deleted expense", async () => {
    const id = await createExpense(input(), actor);
    await updateExpense(id, input({ note: "  Shampoo " }), actor);
    expect(await db.auditLog.count({ where: { entityId: id, action: "expense.updated" } })).toBe(0);
    await softDeleteExpense(id, actor);
    await softDeleteExpense(id, actor);
    expect(await db.auditLog.count({ where: { entityId: id, action: "expense.deleted" } })).toBe(1);
    await expect(updateExpense(id, input({ amountKobo: 1 }), actor)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([
    ["no amount", { amountKobo: 0 }, "amount"],
    ["a future date", { dateKey: addDays(today, 1) }, "date"],
    ["a made-up date", { dateKey: "2026-13-45" }, "date"],
    ["a retired category", { categoryId: "" }, "category"],
    ["a long note", { note: "x".repeat(501) }, "note"],
  ])("refuses %s", async (_name, overrides, field) => {
    const o = field === "category" ? { categoryId: retired } : overrides;
    await expect(createExpense(input(o as Partial<ExpenseInput>), actor)).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { [field]: expect.any(String) } });
    expect(await db.expense.count()).toBe(0);
  });

  it("lists a period by category, newest first, leaving deleted ones out of the list and the total", async () => {
    const yesterday = addDays(today, -1);
    await createExpense(input({ dateKey: yesterday, amountKobo: 100_000 }), actor);
    await createExpense(input({ amountKobo: 200_000 }), actor);
    await createExpense(input({ amountKobo: 300_000, categoryId: rent }), actor);
    const gone = await createExpense(input({ amountKobo: 999_900 }), actor);
    await softDeleteExpense(gone, actor);
    await createExpense(input({ dateKey: addDays(today, -40), amountKobo: 50_000 }), actor);

    const all = await listExpenses({ fromKey: yesterday, toKey: today });
    expect(all.totalKobo).toBe(600_000);
    expect(all.rows.map((r) => r.dateKey)).toEqual([today, today, yesterday]);
    const suppliesOnly = await listExpenses({ fromKey: yesterday, toKey: today, categoryId: supplies });
    expect(suppliesOnly.totalKobo).toBe(300_000);
  });
});

describe("expense categories", () => {
  it("adds one at the end, refuses a duplicate name in any case, and logs it", async () => {
    await saveExpenseCategory({ id: null, name: "  Laundry   bills ", active: true }, actor);
    expect((await activeExpenseCategories()).map((c) => c.name)).toEqual(["Supplies", "Rent", "Laundry bills"]);
    await expect(saveExpenseCategory({ id: null, name: "rent", active: true }, actor)).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { name: expect.any(String) } });
    expect(await db.auditLog.count({ where: { action: "expense_category.created", summary: "Expense category added: Laundry bills" } })).toBe(1);
  });

  it("renames and hides one, keeping it on old expenses", async () => {
    const id = await createExpense(input(), actor);
    await saveExpenseCategory({ id: supplies, name: "Products", active: false }, actor);
    expect((await activeExpenseCategories()).map((c) => c.name)).toEqual(["Rent"]);
    expect((await listExpenses({ fromKey: today, toKey: today })).rows.find((r) => r.id === id)?.categoryName).toBe("Products");
    expect((await listExpenseCategories()).find((c) => c.id === supplies)).toMatchObject({ active: false, expenseCount: 1 });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "expense_category.updated" } })).summary).toBe("Expense category renamed from Supplies to Products and hidden");
  });

  it("keeps at least one category in the add form", async () => {
    await saveExpenseCategory({ id: supplies, name: "Supplies", active: false }, actor);
    await expect(saveExpenseCategory({ id: rent, name: "Rent", active: false }, actor)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });
});
