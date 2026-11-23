import { formatPhone } from "./phone";
import { salonAddress, type SalonDetails, type WeeklyHours } from "./settings";

/**
 * The salon's details as pages, emails and the calendar file use them, from Settings (D4c).
 * Nothing about the client is written in code; blank fields are simply left out.
 */

export type SocialPlatform = "instagram" | "tiktok" | "facebook" | "whatsapp";

export interface Salon {
  name: string;
  /** Street line(s) for the address block; city and state in the last line. */
  addressLines: string[];
  /** All of it on one line. */
  address: string;
  phone: { e164: string; display: string } | null;
  whatsapp: { e164: string; display: string } | null;
  email: string;
  /** The owner's Google Maps link, or a maps search for the name and address. */
  mapsUrl: string;
  social: { platform: SocialPlatform; label: string; href: string }[];
}

export function salonFrom(d: SalonDetails): Salon {
  const address = salonAddress(d);
  const place = [d.city, d.postcode].filter(Boolean).join(" ");
  const phone = (e164: string) => (e164 ? { e164, display: formatPhone(e164) } : null);
  const whatsapp = phone(d.whatsappE164);
  const social: Salon["social"] = [
    { platform: "instagram" as const, label: "Instagram", href: d.instagramUrl },
    { platform: "tiktok" as const, label: "TikTok", href: d.tiktokUrl },
    { platform: "facebook" as const, label: "Facebook", href: d.facebookUrl },
    { platform: "whatsapp" as const, label: "WhatsApp", href: whatsapp ? `https://wa.me/${whatsapp.e164.replace(/\D/g, "")}` : "" },
  ].filter((s) => s.href);
  return {
    name: d.name,
    addressLines: [d.addressLine1, d.addressLine2, [place, d.state].filter(Boolean).join(", ")].map((s) => s.trim()).filter(Boolean),
    address,
    phone: phone(d.phoneE164),
    whatsapp,
    email: d.email,
    mapsUrl: d.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([d.name, address].filter(Boolean).join(", "))}`,
    social,
  };
}

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/**
 * Opening hours in a line or two, Monday first: "Mon–Sat, 9:00 am–7:00 pm" and "Sunday closed".
 * Days next to each other with the same hours are joined.
 */
export function hoursSummary(hours: WeeklyHours, formatTime: (hhmm: string) => string): { open: string[]; closed: string } {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const runs: { from: number; to: number; text: string }[] = [];
  for (const d of order) {
    const h = hours[String(d) as keyof WeeklyHours];
    if (!h) continue;
    const text = `${formatTime(h.open)}–${formatTime(h.close)}`;
    const last = runs.at(-1);
    if (last && last.text === text && order.indexOf(d) === order.indexOf(last.to) + 1) last.to = d;
    else runs.push({ from: d, to: d, text });
  }
  const closedDays = order.filter((d) => !hours[String(d) as keyof WeeklyHours]);
  return {
    open: runs.map((r) => `${r.from === r.to ? SHORT_DAYS[r.from] : `${SHORT_DAYS[r.from]}–${SHORT_DAYS[r.to]}`}, ${r.text}`),
    closed: closedDays.length === 0 ? "Open every day" : closedDays.length === 7 ? "Closed" : `${closedDays.map((d) => LONG_DAYS[d]).join(" and ")} closed`,
  };
}

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string; opensOn: "today" | "tomorrow" | (typeof LONG_DAYS)[number] }
  | { open: false; opensAt: null; opensOn: null };

/**
 * Whether the salon is open at a moment, from the weekly hours. `weekday` (0 is Sunday) and
 * `minutes` (since midnight) are salon time. Open means from opening time up to, not including,
 * closing time. When closed, says when it next opens within the coming week (null if never).
 */
export function openStatus(hours: WeeklyHours, weekday: number, minutes: number): OpenStatus {
  const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const today = hours[String(weekday) as keyof WeeklyHours];
  if (today && minutes >= toMin(today.open) && minutes < toMin(today.close)) return { open: true, closesAt: today.close };
  if (today && minutes < toMin(today.open)) return { open: false, opensAt: today.open, opensOn: "today" };
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = (weekday + ahead) % 7;
    const h = hours[String(day) as keyof WeeklyHours];
    if (h) return { open: false, opensAt: h.open, opensOn: ahead === 1 ? "tomorrow" : LONG_DAYS[day]! };
  }
  return { open: false, opensAt: null, opensOn: null };
}
