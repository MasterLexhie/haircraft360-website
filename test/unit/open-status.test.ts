import { describe, expect, it } from "vitest";
import { openStatus } from "@/domain/salon";
import { DEFAULT_WEEKLY_HOURS } from "@/domain/settings";

// Default hours: Monday to Saturday 09:00 to 19:00, Sunday closed.
const at = (hh: number, mm = 0) => hh * 60 + mm;

describe("openStatus", () => {
  it("is open from opening time up to closing time", () => {
    expect(openStatus(DEFAULT_WEEKLY_HOURS, 1, at(9))).toEqual({ open: true, closesAt: "19:00" });
    expect(openStatus(DEFAULT_WEEKLY_HOURS, 1, at(18, 59))).toEqual({ open: true, closesAt: "19:00" });
  });

  it("before opening, opens later today", () => {
    expect(openStatus(DEFAULT_WEEKLY_HOURS, 3, at(7, 30))).toEqual({ open: false, opensAt: "09:00", opensOn: "today" });
  });

  it("after closing, opens tomorrow", () => {
    expect(openStatus(DEFAULT_WEEKLY_HOURS, 3, at(19))).toEqual({ open: false, opensAt: "09:00", opensOn: "tomorrow" });
  });

  it("skips closed days: Saturday evening opens Monday", () => {
    expect(openStatus(DEFAULT_WEEKLY_HOURS, 6, at(20))).toEqual({ open: false, opensAt: "09:00", opensOn: "Monday" });
  });

  it("on a closed day, opens the next open day", () => {
    expect(openStatus(DEFAULT_WEEKLY_HOURS, 0, at(12))).toEqual({ open: false, opensAt: "09:00", opensOn: "tomorrow" });
  });

  it("never opens when every day is closed", () => {
    const shut = Object.fromEntries(Object.keys(DEFAULT_WEEKLY_HOURS).map((k) => [k, null])) as typeof DEFAULT_WEEKLY_HOURS;
    expect(openStatus(shut, 2, at(10))).toEqual({ open: false, opensAt: null, opensOn: null });
  });
});
