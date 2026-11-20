import { describe, expect, it } from "vitest";
import { DEFAULT_MESSAGE_TEMPLATES, DEFAULT_SALON_DETAILS, DEFAULT_WEEKLY_HOURS, parseSalonDetailsInput, parseTemplatesInput, salonAddress } from "@/domain/settings";
import { unknownPlaceholders } from "@/domain/messages";
import { normalizePhone } from "@/domain/phone";
import { hoursSummary, salonFrom } from "@/domain/salon";

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

describe("salon for pages and emails", () => {
  it("formats phones, builds links and leaves out blanks", () => {
    const s = salonFrom({ ...DEFAULT_SALON_DETAILS, name: "Haircraft 360", addressLine1: "12 Sample Road", city: "Ibadan", state: "Oyo State", phoneE164: "+2348031234567", whatsappE164: "+2348031234567", instagramUrl: "https://instagram.com/x" });
    expect(s.phone).toEqual({ e164: "+2348031234567", display: "0803 123 4567" });
    expect(s.addressLines).toEqual(["12 Sample Road", "Ibadan, Oyo State"]);
    expect(s.social.map((x) => x.platform)).toEqual(["instagram", "whatsapp"]);
    expect(s.social[1]!.href).toBe("https://wa.me/2348031234567");
    expect(s.mapsUrl).toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Haircraft 360, 12 Sample Road, Ibadan, Oyo State")}`);
  });

  it("uses the owner's own maps link when given", () => {
    expect(salonFrom({ ...DEFAULT_SALON_DETAILS, mapsUrl: "https://maps.app.goo.gl/abc" }).mapsUrl).toBe("https://maps.app.goo.gl/abc");
    expect(salonFrom({ ...DEFAULT_SALON_DETAILS, phoneE164: "" }).phone).toBeNull();
  });
});

describe("opening hours summary", () => {
  const fmt = (t: string) => t;
  it("joins neighbouring days with the same hours", () => {
    expect(hoursSummary(DEFAULT_WEEKLY_HOURS, fmt)).toEqual({ open: ["Mon–Sat, 09:00–19:00"], closed: "Sunday closed" });
  });
  it("splits days with different hours and names every closed day", () => {
    const hours = { ...DEFAULT_WEEKLY_HOURS, "1": null, "6": { open: "10:00", close: "16:00" } };
    expect(hoursSummary(hours, fmt)).toEqual({ open: ["Tue–Fri, 09:00–19:00", "Sat, 10:00–16:00"], closed: "Monday and Sunday closed" });
  });
});
