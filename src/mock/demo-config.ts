/**
 * ─────────────────────────────────────────────────────────────────────────
 *  DEMO CONFIGURATION — every value in this file is SAMPLE DATA.
 * ─────────────────────────────────────────────────────────────────────────
 * Haircraft360 has not supplied a service menu, prices, durations, deposit
 * rule, booking horizon, hold window or booking terms. These defaults exist
 * only so the prototype can demonstrate the booking flow. They are editable
 * in Admin → Settings and must be replaced with owner-approved values.
 */
import type { ChecklistItem, Service, Settings } from "@/domain/types";

/**
 * Demo services. Names loosely follow topics mentioned in public review
 * excerpts (starter locs, retwist/maintenance, customised loc work, loc-care
 * advice). They are NOT an approved catalogue; prices/durations are invented
 * sample values for the demo.
 */
export const DEMO_SERVICES: Service[] = [
  {
    id: "svc_starter_locs",
    name: "Starter locs",
    description: "Begin a new loc journey. Method and sizing agreed with you at the appointment.",
    active: true,
    status: "demo",
    priceKobo: 4_500_000,
    durationMinutes: 240,
    sortOrder: 1,
  },
  {
    id: "svc_retwist",
    name: "Loc retwist & maintenance",
    description: "Tidy new growth and refresh existing locs so they stay neat between visits.",
    active: true,
    status: "demo",
    priceKobo: 1_500_000,
    durationMinutes: 120,
    sortOrder: 2,
  },
  {
    id: "svc_custom",
    name: "Custom loc styling",
    description: "A styled look for your locs. Price depends on the style, so it is confirmed with you.",
    active: true,
    status: "demo",
    priceKobo: null,
    durationMinutes: 90,
    sortOrder: 3,
  },
  {
    id: "svc_consult",
    name: "Loc consultation",
    description: "Talk through your hair, goals and a care routine before you commit to a service.",
    active: true,
    status: "demo",
    priceKobo: 500_000,
    durationMinutes: 30,
    sortOrder: 4,
  },
];

/** Owner verification checklist (from the business profile + PRD open questions). */
export const OWNER_CHECKLIST: ChecklistItem[] = [
  { id: "name", label: "Business name and capitalisation", detail: "Confirm “Haircraft360” and whether the listing title may be used in search metadata.", done: false },
  { id: "address", label: "Address and map pin", detail: "Confirm N5, 64B Basorun Road address, postcode 200258, and a precise map pin.", done: false },
  { id: "phone", label: "Phone and WhatsApp", detail: "Confirm 0805 845 5564 and whether WhatsApp is used for enquiries.", done: false },
  { id: "hours", label: "Opening hours", detail: "Confirm Mon–Sat 8 am–9 pm, Sunday closed, plus public-holiday exceptions.", done: false },
  { id: "services", label: "Service menu, prices and durations", detail: "Replace every Demo service with approved names, descriptions, prices and durations.", done: false },
  { id: "deposit", label: "Deposit amount and timing", detail: "PRD open decision. The demo uses a sample percentage rule.", done: false },
  { id: "terms", label: "Cancellation, refund, reschedule and late-arrival terms", detail: "No terms are shown to customers until approved.", done: false },
  { id: "staffing", label: "Staffing and service sequencing", detail: "Demo assumes one chair and services done back-to-back.", done: false },
  { id: "window", label: "Booking horizon and unpaid-slot hold", detail: "Demo uses sample values; owner must choose.", done: false },
  { id: "rating", label: "Rating snapshot display", detail: "5.0 from 50 Google reviews (mirror, 14 Sep 2026). Hidden on the public site until approved.", done: false },
  { id: "content", label: "Description, photos and social links", detail: "None supplied. Placeholders are shown in the prototype.", done: false },
  { id: "notifications", label: "Notifications", detail: "Decide whether launch needs email/SMS/WhatsApp confirmations.", done: false },
  { id: "manual", label: "Manual/offline payment methods", detail: "Confirm which methods the owner may record and for which payments.", done: false },
];

export const DEMO_SETTINGS: Settings = {
  availability: {
    timezone: "Africa/Lagos",
    // Seeded from the public listing's hours (unverified).
    weeklyHours: {
      0: null,
      1: { open: "08:00", close: "21:00" },
      2: { open: "08:00", close: "21:00" },
      3: { open: "08:00", close: "21:00" },
      4: { open: "08:00", close: "21:00" },
      5: { open: "08:00", close: "21:00" },
      6: { open: "08:00", close: "21:00" },
    },
    slotStepMinutes: 30, // demo
    bookingHorizonDays: 30, // demo
    pendingHoldMinutes: 15, // demo
    minimumLeadMinutes: 120, // demo
    defaultDurationMinutes: 60, // demo, used when a service has no duration
    concurrentCapacity: 1, // demo: one chair / stylist
  },
  deposit: {
    type: "percent",
    percent: 30, // demo
    fixedKobo: 500_000,
    minimumKobo: 200_000, // demo ₦2,000
  },
  availabilityStatus: "demo",
  depositStatus: "demo",
  checklist: OWNER_CHECKLIST,
};

/**
 * DEMO ADMIN CREDENTIALS — not production security. A real build must use a
 * proper auth provider with hashed passwords, rate limiting and MFA.
 */
export const DEMO_ADMIN = {
  email: "owner@demo.haircraft360.test",
  password: "demo-owner-2026",
  displayName: "Salon owner (demo)",
};

