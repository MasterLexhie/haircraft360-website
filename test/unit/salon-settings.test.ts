import { describe, expect, it } from "vitest";
import { DEFAULT_MESSAGE_TEMPLATES, DEFAULT_SALON_DETAILS, parseSalonDetailsInput, parseTemplatesInput, salonAddress } from "@/domain/settings";
import { unknownPlaceholders } from "@/domain/messages";
import { normalizePhone } from "@/domain/phone";

describe("message templates", () => {
  it("accepts the suggested wording", () => {
    expect(parseTemplatesInput({ ...DEFAULT_MESSAGE_TEMPLATES }, unknownPlaceholders)).toEqual({ ok: true, value: DEFAULT_MESSAGE_TEMPLATES });
  });

  it("catches a misspelt placeholder, an empty message and a balance message without its link", () => {
    const r = parseTemplatesInput(
      { ...DEFAULT_MESSAGE_TEMPLATES, confirmationWhatsapp: "Hi {nmae}, see you {date}", reminderWhatsapp: "  ", balanceLinkWhatsapp: "Your balance is {balance}" },
      unknownPlaceholders,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.confirmationWhatsapp).toContain("{nmae}");
    expect(r.fieldErrors.reminderWhatsapp).toBeDefined();
    expect(r.fieldErrors.balanceLinkWhatsapp).toContain("{link}");
  });
});

describe("salon details", () => {
  const typed = { name: " Haircraft 360 ", addressLine1: "12 Sample Road", city: "Ibadan", state: "Oyo State", phone: "0803 123 4567", whatsapp: "", email: "Hello@Example.com", mapsUrl: "https://maps.example.com/x" };

  it("stores phones in international format and tidies the rest", () => {
    const r = parseSalonDetailsInput(typed, normalizePhone);
    expect(r).toMatchObject({ ok: true, value: { name: "Haircraft 360", phoneE164: "+2348031234567", whatsappE164: "", email: "hello@example.com" } });
  });

  it("explains each bad field", () => {
    const r = parseSalonDetailsInput({ ...typed, name: "", phone: "12", email: "nope", instagramUrl: "instagram.com/x" }, normalizePhone);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fieldErrors).sort()).toEqual(["email", "instagramUrl", "name", "phone"]);
  });

  it("joins the address into one line, skipping blanks", () => {
    expect(salonAddress({ ...DEFAULT_SALON_DETAILS, addressLine1: "12 Sample Road", addressLine2: "", city: "Ibadan", postcode: "200258", state: "Oyo State" })).toBe("12 Sample Road, Ibadan 200258, Oyo State");
  });
});
