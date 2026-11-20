import { describe, expect, it } from "vitest";
import { pageHref, paginate } from "@/domain/paginate";

const days = Array.from({ length: 30 }, (_, i) => i + 1);

describe("paginate", () => {
  it("cuts a list into pages and says what's showing", () => {
    expect(paginate(days, "2", 10)).toMatchObject({ page: 2, pageCount: 3, first: 11, last: 20, total: 30, items: days.slice(10, 20) });
    expect(paginate(days.slice(0, 31 - 8), "3", 10)).toMatchObject({ page: 3, first: 21, last: 23, items: [21, 22, 23] });
  });

  it("lands on a real page whatever the address says", () => {
    for (const odd of [undefined, "", "0", "-4", "abc"]) expect(paginate(days, odd, 10).page).toBe(1);
    expect(paginate(days, "99", 10)).toMatchObject({ page: 3, first: 21, last: 30 });
  });

  it("copes with an empty list", () => {
    expect(paginate([], "1", 10)).toEqual({ page: 1, pageCount: 1, first: 0, last: 0, total: 0, items: [] });
  });
});

describe("page links", () => {
  it("keep the filters, drop empty ones, and leave page 1 out", () => {
    expect(pageHref("/admin/finances", { period: "custom", from: "2026-11-01", to: "2026-11-30", page: "4" }, 2)).toBe("/admin/finances?period=custom&from=2026-11-01&to=2026-11-30&page=2");
    expect(pageHref("/admin/finances", { period: "month", from: "", to: undefined }, 1)).toBe("/admin/finances?period=month");
    expect(pageHref("/admin/finances/expenses", {}, 1)).toBe("/admin/finances/expenses");
  });
});
