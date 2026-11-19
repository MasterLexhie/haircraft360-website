import { describe, expect, it } from "vitest";
import { formatPhone, isPlaceholderEmail, isValidEmail, normalizeEmail, normalizePhone, placeholderEmailFor, whatsappNumber } from "@/domain/phone";
import { validateContact } from "@/domain/validation";

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

describe("validateContact (booking details step and server)", () => {
  const base = { name: "Ada Okafor", phone: "0803 123 4567", email: "ada@example.com", noEmail: false };

  it("accepts a name, a Nigerian mobile and an email", () => {
    expect(validateContact(base)).toEqual({});
  });

  it("always requires a phone, even when the email is given", () => {
    expect(validateContact({ ...base, phone: "" }).phone).toMatch(/phone number/);
    expect(validateContact({ ...base, phone: "0123" }).phone).toMatch(/Nigerian mobile/);
  });

  it("requires an email unless “I don't have an email” is ticked", () => {
    expect(validateContact({ ...base, email: "" }).email).toMatch(/tick/);
    expect(validateContact({ ...base, email: "not-an-email" }).email).toMatch(/name@example.com/);
    expect(validateContact({ ...base, email: "", noEmail: true })).toEqual({});
  });

  it("asks for a real name", () => {
    expect(validateContact({ ...base, name: " a " }).name).toBeDefined();
    expect(validateContact({ ...base, name: "x".repeat(81) }).name).toBeDefined();
  });
});
