import { describe, expect, it } from "vitest";
import { describeClosurePeriod } from "@/domain/closures";
import { lagosToUtcMs } from "@/lib/time";

const at = (day: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(lagosToUtcMs(day, h * 60 + m)).toISOString();
};

describe("describeClosurePeriod", () => {
  it("calls a midnight-to-midnight closure all day, not 12:00 am to 12:00 am", () => {
    expect(describeClosurePeriod(at("2026-11-28", "00:00"), at("2026-11-29", "00:00"))).toBe("Sat, 28 Nov 2026, all day");
  });

  it("names the first and last day of a closure over several whole days", () => {
    expect(describeClosurePeriod(at("2026-12-24", "00:00"), at("2026-12-27", "00:00"))).toBe("Thu, 24 Dec 2026 to Sat, 26 Dec 2026, all day");
  });

  it("gives the times of a closure within one day", () => {
    expect(describeClosurePeriod(at("2026-11-27", "14:00"), at("2026-11-27", "19:00"))).toBe("Fri, 27 Nov 2026, 2:00 pm to 7:00 pm");
  });

  it("gives days and times for a part-day closure across days", () => {
    expect(describeClosurePeriod(at("2026-11-27", "14:00"), at("2026-11-28", "12:00"))).toBe("Fri, 27 Nov 2026 2:00 pm to Sat, 28 Nov 2026 12:00 pm");
  });
});
