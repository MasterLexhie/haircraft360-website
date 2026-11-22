import { describe, expect, it } from "vitest";
import { financeHref, financeReturn, newExpenseHref } from "@/domain/finance-nav";

describe("finance navigation", () => {
  it("returns only to Finances pages", () => {
    expect(financeReturn("/admin/finances")).toBe("/admin/finances");
    expect(financeReturn("/admin/finances?period=week")).toBe("/admin/finances?period=week");
    expect(financeReturn("/admin/finances/expenses?period=custom&from=2026-11-01&to=2026-11-20&category=abc")).toBe(
      "/admin/finances/expenses?period=custom&from=2026-11-01&to=2026-11-20&category=abc",
    );
    for (const bad of ["https://evil.test", "//evil.test", "/admin/bookings", "/admin/finances/../settings", "/admin/financesx", "/admin/finances?x=<script>", undefined, ""]) {
      expect(financeReturn(bad)).toBe("/admin/finances/expenses");
    }
  });

  it("keeps the period and filters in links", () => {
    expect(financeHref("/admin/finances", {})).toBe("/admin/finances");
    expect(financeHref("/admin/finances/expenses", { period: "week", from: undefined }, { category: "c1" })).toBe("/admin/finances/expenses?period=week&category=c1");
    expect(newExpenseHref("/admin/finances?period=week")).toBe("/admin/finances/expenses/new?back=%2Fadmin%2Ffinances%3Fperiod%3Dweek");
  });
});
