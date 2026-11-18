import { describe, expect, it } from "vitest";
import {
  capacityByWeekdaySchema,
  DEFAULT_CAPACITY_BY_WEEKDAY,
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_SALON_DETAILS,
  DEFAULT_WEEKLY_HOURS,
  messageTemplatesSchema,
  salonDetailsSchema,
  weeklyHoursSchema,
} from "@/domain/settings";
import { assertLocalDatabase } from "../../prisma/seed";

describe("settings schemas", () => {
  it("accept the placeholder defaults", () => {
    expect(weeklyHoursSchema.parse(DEFAULT_WEEKLY_HOURS)).toEqual(DEFAULT_WEEKLY_HOURS);
    expect(capacityByWeekdaySchema.parse(DEFAULT_CAPACITY_BY_WEEKDAY)).toEqual(DEFAULT_CAPACITY_BY_WEEKDAY);
    expect(messageTemplatesSchema.parse(DEFAULT_MESSAGE_TEMPLATES)).toEqual(DEFAULT_MESSAGE_TEMPLATES);
    expect(salonDetailsSchema.parse(DEFAULT_SALON_DETAILS)).toEqual(DEFAULT_SALON_DETAILS);
  });

  it("reject opening after closing and bad times", () => {
    expect(weeklyHoursSchema.safeParse({ ...DEFAULT_WEEKLY_HOURS, "1": { open: "18:00", close: "09:00" } }).success).toBe(false);
    expect(weeklyHoursSchema.safeParse({ ...DEFAULT_WEEKLY_HOURS, "1": { open: "9am", close: "18:00" } }).success).toBe(false);
  });

  it("reject negative or fractional capacity", () => {
    expect(capacityByWeekdaySchema.safeParse({ ...DEFAULT_CAPACITY_BY_WEEKDAY, "2": -1 }).success).toBe(false);
    expect(capacityByWeekdaySchema.safeParse({ ...DEFAULT_CAPACITY_BY_WEEKDAY, "2": 1.5 }).success).toBe(false);
  });
});

describe("seed guard", () => {
  it("allows local databases", () => {
    expect(assertLocalDatabase("postgresql://postgres@localhost:5432/x")).toContain("localhost");
    expect(assertLocalDatabase("postgresql://postgres@127.0.0.1:5432/x")).toContain("127.0.0.1");
  });

  it("refuses remote databases", () => {
    expect(() => assertLocalDatabase("postgresql://u:p@db.abcd.supabase.co:5432/postgres")).toThrow(/not local/);
    expect(() => assertLocalDatabase(undefined)).toThrow(/not set/);
  });
});
