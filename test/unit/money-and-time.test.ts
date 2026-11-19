import { describe, expect, it } from "vitest";
import { formatNaira, koboToInput, parseNairaToKobo } from "@/lib/money";
import { addDays, dayOfWeek, lagosDateKey, lagosMinutes, lagosToUtcMs } from "@/lib/time";

describe("money", () => {
  it("formats kobo as naira", () => {
    expect(formatNaira(450_000)).toBe("₦4,500");
  });

  it("parses typed naira into integer kobo", () => {
    expect(parseNairaToKobo("4,500")).toBe(450_000);
    expect(parseNairaToKobo("₦4500.50")).toBe(450_050);
    expect(parseNairaToKobo("")).toBeNull();
    expect(parseNairaToKobo("4.555")).toBeNull();
    expect(parseNairaToKobo("10,000,000")).toBe(1_000_000_000);
    expect(parseNairaToKobo("10,000,001")).toBeNull();
    expect(parseNairaToKobo("99999999999999999999")).toBeNull();
  });

  it("round-trips kobo for form inputs", () => {
    expect(koboToInput(450_000)).toBe("4500");
    expect(koboToInput(450_050)).toBe("4500.50");
  });
});

describe("Lagos time (UTC+1, no daylight saving)", () => {
  it("maps late UTC evening to the next Lagos day", () => {
    expect(lagosDateKey("2026-11-30T23:30:00Z")).toBe("2026-12-01");
    expect(lagosMinutes("2026-11-30T23:30:00Z")).toBe(30);
  });

  it("converts a Lagos wall time to UTC", () => {
    expect(new Date(lagosToUtcMs("2026-12-01", 9 * 60)).toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });

  it("does date arithmetic on day keys", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(dayOfWeek("2026-11-22")).toBe(0);
  });
});
