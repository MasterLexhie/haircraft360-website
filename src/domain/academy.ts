import { parseNairaToKobo } from "@/lib/money";
import { addDays, isValidDateKey } from "@/lib/time";
import { isValidEmail, normalizeEmail, normalizePhone } from "./phone";

/**
 * Locs Mastery: training programs and the application form. The form asks for basic
 * personal details only (no ID documents), checked the same way on the server.
 */

export type ApplicationStatus = "new" | "contacted" | "accepted" | "declined" | "withdrawn";
export type ExperienceLevel = "none" | "some" | "working";

export const APPLICATION_STATUSES: ApplicationStatus[] = ["new", "contacted", "accepted", "declined", "withdrawn"];

export const applicationStatusLabel: Record<ApplicationStatus, { label: string; tone: "info" | "warning" | "success" | "danger" | "neutral"; help: string }> = {
  new: { label: "New", tone: "info", help: "Not looked at yet." },
  contacted: { label: "Contacted", tone: "warning", help: "You've been in touch; no decision yet." },
  accepted: { label: "Accepted", tone: "success", help: "Offered a place." },
  declined: { label: "Declined", tone: "danger", help: "Not offered a place this time." },
  withdrawn: { label: "Withdrawn", tone: "neutral", help: "The applicant stepped back." },
};

export const experienceLabel: Record<ExperienceLevel, string> = {
  none: "New to locs",
  some: "Some experience (own hair, friends or family)",
  working: "Already working on clients",
};

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "Outside Nigeria",
] as const;

export const HOW_HEARD = ["Instagram", "TikTok", "Facebook", "WhatsApp", "A friend or client", "Visited the salon", "Google", "Other"] as const;

export const MIN_AGE = 16;
const MAX_AGE = 90;
export const MOTIVATION_MIN = 20;
export const MOTIVATION_MAX = 1500;

export interface ApplicationInput {
  programId: string;
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  city: string;
  state: string;
  experience: ExperienceLevel;
  motivation: string;
  howHeard: string;
  marketingConsent: boolean;
}

/** Whole years between a date of birth and today (both "YYYY-MM-DD"). */
export function ageOn(dateOfBirth: string, todayKey: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = todayKey.split("-").map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** The latest date of birth that is old enough today, for the date picker's max. */
export function latestBirthDate(todayKey: string): string {
  const [y, m, d] = todayKey.split("-");
  const key = `${Number(y) - MIN_AGE}-${m}-${d}`;
  return isValidDateKey(key) ? key : addDays(`${Number(y) - MIN_AGE}-03-01`, -1);
}

/**
 * Checks the form. Returns tidied values, or a message per field. `programIds` are the programs
 * open for applications right now.
 */
export function validateApplication(
  raw: Record<string, string | undefined>,
  opts: { todayKey: string; programIds: string[] },
): { ok: true; value: ApplicationInput } | { ok: false; fieldErrors: Record<string, string> } {
  const get = (k: string) => (raw[k] ?? "").trim();
  const e: Record<string, string> = {};

  const programId = get("programId");
  if (!opts.programIds.includes(programId)) e.programId = "Choose a program that's open for applications.";

  const fullName = get("fullName").replace(/\s+/g, " ");
  if (fullName.length < 2) e.fullName = "Enter your full name.";
  else if (fullName.length > 80) e.fullName = "Keep your name under 80 characters.";

  const phone = normalizePhone(get("phone"));
  if (!phone) e.phone = "Enter a phone number like 0803 123 4567.";

  const email = normalizeEmail(get("email"));
  if (!isValidEmail(email) || email.length > 120) e.email = "Enter an email address like name@example.com.";

  const dateOfBirth = get("dateOfBirth");
  if (!isValidDateKey(dateOfBirth)) e.dateOfBirth = "Enter your date of birth.";
  else {
    const age = ageOn(dateOfBirth, opts.todayKey);
    if (age < MIN_AGE) e.dateOfBirth = `You need to be at least ${MIN_AGE} to apply.`;
    else if (age > MAX_AGE) e.dateOfBirth = "Check the year of your date of birth.";
  }

  const city = get("city").replace(/\s+/g, " ");
  if (!city) e.city = "Enter the town or city you live in.";
  else if (city.length > 60) e.city = "Keep it under 60 characters.";

  const state = get("state");
  if (!(NIGERIAN_STATES as readonly string[]).includes(state)) e.state = "Choose your state.";

  const experience = get("experience") as ExperienceLevel;
  if (!(experience in experienceLabel)) e.experience = "Choose the option closest to you.";

  const motivation = get("motivation").replace(/\r\n/g, "\n");
  if (motivation.length < MOTIVATION_MIN) e.motivation = `Tell us a little more (at least ${MOTIVATION_MIN} characters).`;
  else if (motivation.length > MOTIVATION_MAX) e.motivation = `Keep it under ${MOTIVATION_MAX} characters.`;

  const howHeard = get("howHeard");
  const howHeardOk = howHeard === "" || (HOW_HEARD as readonly string[]).includes(howHeard);

  if (raw.consent !== "on") e.consent = "Tick the box to agree, so we can use your details for your application.";

  if (Object.keys(e).length) return { ok: false, fieldErrors: e };
  return {
    ok: true,
    value: { programId, fullName, phone: phone!, email, dateOfBirth, city, state, experience, motivation, howHeard: howHeardOk ? howHeard : "", marketingConsent: raw.marketingConsent === "on" },
  };
}

/** Program fields from the owner's form (Settings › Programs). */
export interface ProgramInput {
  name: string;
  summary: string;
  duration: string;
  format: string;
  level: string;
  outcomes: string[];
  /** Null when the fee is discussed with each applicant instead of shown. */
  priceKobo: number | null;
  active: boolean;
  acceptingApplications: boolean;
}

export const MAX_OUTCOMES = 12;

export function validateProgram(raw: Record<string, string | undefined>): { ok: true; value: ProgramInput } | { ok: false; fieldErrors: Record<string, string> } {
  const get = (k: string) => (raw[k] ?? "").trim();
  const e: Record<string, string> = {};
  const limit = (k: string, label: string, max: number, required: boolean) => {
    const v = get(k);
    if (required && !v) e[k] = `Enter ${label}.`;
    else if (v.length > max) e[k] = `Keep it under ${max} characters.`;
    return v;
  };
  const name = limit("name", "a name", 80, true);
  const summary = limit("summary", "a short description", 400, true);
  const duration = limit("duration", "how long it runs, for example 6 weeks", 40, true);
  const format = limit("format", "", 120, false);
  const level = limit("level", "", 80, false);
  const outcomes = get("outcomes")
    .split("\n")
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);
  if (outcomes.length === 0) e.outcomes = "Add at least one thing students learn, one per line.";
  else if (outcomes.length > MAX_OUTCOMES) e.outcomes = `Keep it to ${MAX_OUTCOMES} lines or fewer.`;
  else if (outcomes.some((o) => o.length > 160)) e.outcomes = "Keep each line under 160 characters.";
  const priceRaw = get("price");
  const priceKobo = priceRaw ? parseNairaToKobo(priceRaw) : null;
  if (priceRaw && (priceKobo === null || priceKobo <= 0)) e.price = "Enter the fee in naira, for example 150000, or leave it blank to discuss it with each applicant.";
  if (Object.keys(e).length) return { ok: false, fieldErrors: e };
  return { ok: true, value: { name, summary, duration, format, level, outcomes, priceKobo, active: raw.active === "on", acceptingApplications: raw.acceptingApplications === "on" } };
}
