import { DEFAULT_MESSAGE_TEMPLATES, DEFAULT_SALON_DETAILS, type CapacityByWeekday, type WeeklyHours } from "@/domain/settings";
import { addDays, lagosDateKey, lagosToUtcMs } from "@/lib/time";
import { db } from "./db";

/** Every day open 09:00 to 19:00, so tests never land on a closed day. */
const ALL_WEEK: WeeklyHours = Object.fromEntries(["0", "1", "2", "3", "4", "5", "6"].map((d) => [d, { open: "09:00", close: "19:00" }])) as WeeklyHours;

export async function createSettings(overrides: { capacity?: number; bufferMinutes?: number; holdMinutes?: number } = {}) {
  const capacity = Object.fromEntries(["0", "1", "2", "3", "4", "5", "6"].map((d) => [d, overrides.capacity ?? 1])) as CapacityByWeekday;
  return db.settings.create({
    data: {
      id: 1,
      slotIntervalMinutes: 30,
      bufferMinutes: overrides.bufferMinutes ?? 0,
      holdMinutes: overrides.holdMinutes ?? 15,
      minimumLeadMinutes: 0,
      bookingHorizonDays: 60,
      weeklyHours: ALL_WEEK,
      capacityByWeekday: capacity,
      depositType: "percent",
      depositPercent: 30,
      depositFixedKobo: 0,
      depositScope: "full_total",
      depositMinimumKobo: null,
      messageTemplates: DEFAULT_MESSAGE_TEMPLATES,
      salonDetails: DEFAULT_SALON_DETAILS,
    },
  });
}

export async function createServices() {
  const main = await db.service.create({ data: { id: "svc_main", name: "Retwist", priceKobo: 1_500_000, durationMinutes: 120, bookableAlone: true } });
  const wash = await db.service.create({ data: { id: "svc_wash", name: "Wash", priceKobo: 300_000, durationMinutes: 30, bookableAlone: false, availableAsAddOn: true } });
  const other = await db.service.create({ data: { id: "svc_other", name: "Scalp", priceKobo: 500_000, durationMinutes: 30, bookableAlone: false, availableAsAddOn: true } });
  await db.serviceAddOn.create({ data: { mainServiceId: main.id, addOnServiceId: wash.id } });
  return { main, wash, other };
}

/** A Lagos wall-clock time a few days ahead, as an ISO string. */
export function slot(daysAhead: number, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(lagosToUtcMs(addDays(lagosDateKey(Date.now()), daysAhead), h * 60 + m)).toISOString();
}

let phoneSeq = 1000;
export function bookingInput(overrides: Partial<Record<string, unknown>> = {}) {
  phoneSeq++;
  return {
    mainServiceId: "svc_main",
    addOnIds: [] as string[],
    startAt: slot(3, "10:00"),
    name: "Ada Okafor",
    phone: `0803555${String(phoneSeq).padStart(4, "0")}`,
    email: `ada${phoneSeq}@example.com`,
    noEmail: false,
    marketingConsent: false,
    customerNote: "",
    ...overrides,
  };
}

/** A WebP header in the extended (VP8X) form, as browsers write it, with the given size. */
export function webpBytes(width: number, height: number): Uint8Array {
  const b = new Uint8Array(40);
  const put = (at: number, text: string) => [...text].forEach((c, i) => (b[at + i] = c.charCodeAt(0)));
  put(0, "RIFF");
  put(8, "WEBP");
  put(12, "VP8X");
  const w = width - 1, h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  b.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return b;
}
