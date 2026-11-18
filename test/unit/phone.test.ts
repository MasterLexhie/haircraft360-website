import { describe, expect, it } from "vitest";
import { formatPhone, isPlaceholderEmail, isValidEmail, normalizeEmail, normalizePhone, placeholderEmailFor, whatsappNumber } from "@/domain/phone";

describe("normalizePhone", () => {
  it.each([
    ["08031234567", "+2348031234567"],
    ["0803 123 4567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["234 803 123 4567", "+2348031234567"],
    ["+2348031234567", "+2348031234567"],
    ["+234 (803) 123-4567", "+2348031234567"],
    ["07012345678", "+2347012345678"],
    ["09012345678", "+2349012345678"],
  ])("normalises %s to E.164", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "   ", "12345", "0803123456", "080312345678", "not a phone"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("keeps foreign numbers when the country code is given", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
  });
});

describe("formatting and helpers", () => {
  it("formats Nigerian numbers in local style", () => {
    expect(formatPhone("+2348031234567")).toBe("0803 123 4567");
  });

  it("builds wa.me digits", () => {
    expect(whatsappNumber("+2348031234567")).toBe("2348031234567");
  });

  it("normalises and validates email", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(isValidEmail("ada@example.com")).toBe(true);
    expect(isValidEmail("ada@example")).toBe(false);
  });

  it("generates a recognisable placeholder email from the phone", () => {
    const email = placeholderEmailFor("+2348031234567", "haircraft360.ng");
    expect(email).toBe("2348031234567@noemail.haircraft360.ng");
    expect(isPlaceholderEmail(email)).toBe(true);
    expect(isPlaceholderEmail("ada@example.com")).toBe(false);
  });
});
