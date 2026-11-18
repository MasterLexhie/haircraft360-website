import "server-only";
import type { Settings } from "@/domain/types";
import { db, type Tx } from "./db";
import { toSettings } from "./mappers";

/** The single Settings row. Missing settings mean the database was never seeded or set up. */
export async function loadSettings(client: Tx | typeof db = db): Promise<Settings> {
  const row = await client.settings.findUnique({ where: { id: 1 } });
  if (!row) throw new Error("Settings are missing. Run `npm run db:seed` locally, or create them in production setup.");
  return toSettings(row);
}
