import { z } from "zod";

/**
 * Shapes of the JSON columns on the Settings row (prisma/schema.prisma).
 * Every read goes through these schemas so a bad value can never reach the booking engine.
 * Client specifics (hours, capacity, wording, address) live here as data, never in code.
 */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, for example 09:00.");

export const dayHoursSchema = z
  .object({ open: hhmm, close: hhmm })
  .refine((d) => d.open < d.close, { message: "Opening time must be before closing time." });

const weekdayKeys = ["0", "1", "2", "3", "4", "5", "6"] as const;
export type WeekdayKey = (typeof weekdayKeys)[number];

/** 0 = Sunday ... 6 = Saturday. null = closed that day. */
export const weeklyHoursSchema = z.object(
  Object.fromEntries(weekdayKeys.map((k) => [k, dayHoursSchema.nullable()])) as Record<WeekdayKey, z.ZodNullable<typeof dayHoursSchema>>,
);
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;

/** Customers the salon can serve at the same moment, per weekday. */
export const capacityByWeekdaySchema = z.object(
  Object.fromEntries(weekdayKeys.map((k) => [k, z.number().int().min(0).max(20)])) as Record<WeekdayKey, z.ZodNumber>,
);
export type CapacityByWeekday = z.infer<typeof capacityByWeekdaySchema>;

/**
 * Owner-editable message wording. Placeholders: {name}, {service}, {date}, {time},
 * {total}, {deposit}, {balance}, {link}, {salon}, {address}.
 */
export const messageTemplatesSchema = z.object({
  confirmationWhatsapp: z.string().min(1).max(1000),
  reminderWhatsapp: z.string().min(1).max(1000),
  balanceLinkWhatsapp: z.string().min(1).max(1000),
  confirmationEmailIntro: z.string().min(1).max(2000),
  reminderEmailIntro: z.string().min(1).max(2000),
});
export type MessageTemplates = z.infer<typeof messageTemplatesSchema>;

export const salonDetailsSchema = z.object({
  name: z.string().min(1).max(80),
  addressLine1: z.string().max(120),
  addressLine2: z.string().max(120),
  city: z.string().max(80),
  state: z.string().max(80),
  postcode: z.string().max(20),
  phoneE164: z.string().max(20),
  whatsappE164: z.string().max(20),
  email: z.string().max(120),
  mapsUrl: z.string().max(500),
  instagramUrl: z.string().max(300),
  tiktokUrl: z.string().max(300),
  facebookUrl: z.string().max(300),
});
export type SalonDetails = z.infer<typeof salonDetailsSchema>;

/* ───────────────────── Placeholder defaults (fake until the client confirms) ───────────────────── */

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  "0": null,
  "1": { open: "09:00", close: "19:00" },
  "2": { open: "09:00", close: "19:00" },
  "3": { open: "09:00", close: "19:00" },
  "4": { open: "09:00", close: "19:00" },
  "5": { open: "09:00", close: "19:00" },
  "6": { open: "09:00", close: "19:00" },
};

export const DEFAULT_CAPACITY_BY_WEEKDAY: CapacityByWeekday = { "0": 0, "1": 2, "2": 2, "3": 2, "4": 2, "5": 3, "6": 3 };

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplates = {
  confirmationWhatsapp:
    "Hello {name}, your {service} appointment at {salon} is confirmed for {date} at {time}. Deposit received, balance due on the day: {balance}. View your booking: {link}",
  reminderWhatsapp: "Hello {name}, a reminder of your {service} appointment at {salon} tomorrow, {date} at {time}. Address: {address}.",
  balanceLinkWhatsapp: "Hello {name}, thank you for visiting {salon}. Your balance is {balance}. You can pay securely here: {link}",
  confirmationEmailIntro: "Thank you for booking with {salon}. Your appointment is confirmed.",
  reminderEmailIntro: "This is a reminder of your appointment at {salon} tomorrow.",
};

export const DEFAULT_SALON_DETAILS: SalonDetails = {
  name: "Haircraft 360",
  addressLine1: "Sample address line (replace in Settings)",
  addressLine2: "",
  city: "Ibadan",
  state: "Oyo State",
  postcode: "",
  phoneE164: "",
  whatsappE164: "",
  email: "",
  mapsUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  facebookUrl: "",
};
