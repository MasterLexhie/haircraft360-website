import { describe, expect, it } from "vitest";
import { ageOn, latestBirthDate, validateApplication, validateProgram } from "@/domain/academy";

const today = "2026-11-21";
const good = {
  programId: "p1",
  fullName: "  Amaka   Eze ",
  phone: "0803 123 4567",
  email: "Amaka@Example.com ",
  dateOfBirth: "2000-05-14",
  city: "Ibadan",
  state: "Oyo",
  experience: "some",
  motivation: "I want to start locking hair for clients in my area.",
  howHeard: "Instagram",
  consent: "on",
};
const check = (over: Record<string, string | undefined>) => validateApplication({ ...good, ...over }, { todayKey: today, programIds: ["p1"] });

describe("Locs Mastery application", () => {
  it("accepts a complete form and tidies it", () => {
    expect(check({})).toEqual({
      ok: true,
      value: { programId: "p1", fullName: "Amaka Eze", phone: "+2348031234567", email: "amaka@example.com", dateOfBirth: "2000-05-14", city: "Ibadan", state: "Oyo", experience: "some", motivation: good.motivation, howHeard: "Instagram", marketingConsent: false },
    });
  });

  it("explains every missing or wrong field", () => {
    const r = validateApplication({}, { todayKey: today, programIds: ["p1"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(["city", "consent", "dateOfBirth", "email", "experience", "fullName", "motivation", "phone", "programId", "state"]);
  });

  it("refuses a closed program, an under-age applicant and a made-up state", () => {
    const r = check({ programId: "p2", dateOfBirth: "2011-01-01", state: "Atlantis" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(["dateOfBirth", "programId", "state"]);
  });

  it("counts age in whole years", () => {
    expect(ageOn("2010-11-21", today)).toBe(16);
    expect(ageOn("2010-11-22", today)).toBe(15);
    expect(latestBirthDate(today)).toBe("2010-11-21");
    expect(latestBirthDate("2028-02-29")).toBe("2012-02-29");
    expect(latestBirthDate("2032-02-29")).toBe("2016-02-29");
    expect(latestBirthDate("2029-02-28")).toBe("2013-02-28");
  });

  it("drops an unknown 'how did you hear' answer rather than refusing", () => {
    expect(check({ howHeard: "<script>" })).toMatchObject({ ok: true, value: { howHeard: "" } });
  });
});

describe("program form", () => {
  it("reads what students learn one per line, without bullets", () => {
    const r = validateProgram({ name: "Foundations", summary: "Start here.", duration: "6 weeks", outcomes: "- Sectioning\n\n• Starter methods\r\nClient care", active: "on" });
    expect(r).toMatchObject({ ok: true, value: { outcomes: ["Sectioning", "Starter methods", "Client care"], active: true, acceptingApplications: false } });
  });
  it("takes an optional fee in naira", () => {
    const base = { name: "Foundations", summary: "Start here.", duration: "6 weeks", outcomes: "Sectioning" };
    expect(validateProgram(base)).toMatchObject({ ok: true, value: { priceKobo: null } });
    expect(validateProgram({ ...base, price: " ₦150,000 " })).toMatchObject({ ok: true, value: { priceKobo: 15_000_000 } });
    for (const price of ["abc", "0", "-5", "12.345"]) {
      const r = validateProgram({ ...base, price });
      expect(r.ok, price).toBe(false);
      if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual(["price"]);
    }
  });
  it("needs a name, description, length and at least one outcome", () => {
    const r = validateProgram({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(["duration", "name", "outcomes", "summary"]);
  });
});
