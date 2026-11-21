import "server-only";
import type { Settings } from "@/domain/types";
import { DEFAULT_CAPACITY_BY_WEEKDAY, DEFAULT_MESSAGE_TEMPLATES, DEFAULT_SALON_DETAILS, DEFAULT_WEEKLY_HOURS } from "@/domain/settings";
import { db, type Tx } from "./db";
import { toSettings } from "./mappers";

/**
 * Starting settings for a brand-new database (staging, then production). Nothing customer-facing
 * is invented: the owner replaces the hours, capacity, deposit rule and salon details in Settings.
 * The scalar columns (slot interval, hold, lead time, deposit rule) take the schema defaults.
 */
const STARTING_SETTINGS = {
  id: 1,
  weeklyHours: DEFAULT_WEEKLY_HOURS,
  capacityByWeekday: DEFAULT_CAPACITY_BY_WEEKDAY,
  messageTemplates: DEFAULT_MESSAGE_TEMPLATES,
  salonDetails: DEFAULT_SALON_DETAILS,
};

/**
 * The single Settings row. A new database has none, so the first request creates it with the
 * starting settings (once, even if several requests arrive together) and notes it in the
 * activity log. The seed fills in sample values locally instead.
 */
export async function loadSettings(client: Tx | typeof db = db): Promise<Settings> {
  const row = await client.settings.findUnique({ where: { id: 1 } });
  if (row) return toSettings(row);
  // Only the request that actually inserts the row (count 1) records it.
  const { count } = await client.settings.createMany({ data: [STARTING_SETTINGS], skipDuplicates: true });
  if (count === 1) {
    await client.auditLog.create({
      data: { actorLabel: "System", action: "settings.created", entityType: "settings", entityId: "1", summary: "Starting settings created for a new database. Replace them in Settings." },
    });
  }
  return toSettings(await client.settings.findUniqueOrThrow({ where: { id: 1 } }));
}
