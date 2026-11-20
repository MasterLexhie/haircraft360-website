import { describe, expect, it } from "vitest";
import { changeLabel, daysBetween, monthToDateComparison, resolvePeriod } from "@/domain/periods";

// Friday 20 November 2026
const today = "2026-11-20";

describe("report periods", () => {
  it("covers today, this week from Monday, this month and last month", () => {
    expect(resolvePeriod(today, { period: "today" })).toMatchObject({ fromKey: today, toKey: today });
    expect(resolvePeriod(today, { period: "week" })).toMatchObject({ fromKey: "2026-11-16", toKey: "2026-11-22" });
    expect(resolvePeriod(today, { period: "month" })).toMatchObject({ fromKey: "2026-11-01", toKey: "2026-11-30" });
    expect(resolvePeriod(today, { period: "last_month" })).toMatchObject({ fromKey: "2026-10-01", toKey: "2026-10-31" });
    expect(resolvePeriod("2027-01-05", { period: "last_month" })).toMatchObject({ fromKey: "2026-12-01", toKey: "2026-12-31" });
    expect(resolvePeriod("2028-02-10", { period: "month" })).toMatchObject({ fromKey: "2028-02-01", toKey: "2028-02-29" });
  });

  it("starts the week on Monday even on a Sunday", () => {
    expect(resolvePeriod("2026-11-22", { period: "week" })).toMatchObject({ fromKey: "2026-11-16", toKey: "2026-11-22" });
    expect(resolvePeriod("2026-11-23", { period: "week" })).toMatchObject({ fromKey: "2026-11-23", toKey: "2026-11-29" });
  });

  it("takes custom dates, and falls back to this month with a reason when they're unusable", () => {
    expect(resolvePeriod(today, { period: "custom", from: "2026-11-03", to: "2026-11-09" })).toMatchObject({ preset: "custom", fromKey: "2026-11-03", toKey: "2026-11-09", error: undefined });
    expect(resolvePeriod(today, { period: "custom", from: "2026-11-09", to: "2026-11-03" })).toMatchObject({ preset: "month", error: expect.stringContaining("after") });
    expect(resolvePeriod(today, { period: "custom", from: "2025-01-01", to: "2026-11-03" })).toMatchObject({ preset: "month", error: expect.stringContaining("366") });
    expect(resolvePeriod(today, { period: "custom", from: "nonsense", to: "2026-11-03" })).toMatchObject({ preset: "month", error: expect.any(String) });
    expect(resolvePeriod(today, { period: "whatever" })).toMatchObject({ preset: "month", error: undefined });
  });

  it("counts days inclusively", () => {
    expect(daysBetween("2026-11-01", "2026-11-30")).toBe(30);
    expect(daysBetween(today, today)).toBe(1);
  });
});

describe("month so far against last month", () => {
  it("compares the same days", () => {
    expect(monthToDateComparison("2026-11-20")).toEqual({ fromKey: "2026-11-01", toKey: "2026-11-20", lastFromKey: "2026-10-01", lastToKey: "2026-10-20" });
  });
  it("stops at the end of a shorter month", () => {
    expect(monthToDateComparison("2026-03-31")).toMatchObject({ lastFromKey: "2026-02-01", lastToKey: "2026-02-28" });
    expect(monthToDateComparison("2026-01-15")).toMatchObject({ lastFromKey: "2025-12-01", lastToKey: "2025-12-15" });
  });
  it("labels the change in plain words", () => {
    expect(changeLabel(112_000, 100_000)).toBe("12% more");
    expect(changeLabel(95_000, 100_000)).toBe("5% less");
    expect(changeLabel(100_000, 100_000)).toBe("same");
    expect(changeLabel(0, 0)).toBe("same");
    expect(changeLabel(5_000, 0)).toBeNull();
    expect(changeLabel(-5_000, -10_000)).toBe("50% more");
  });
});
