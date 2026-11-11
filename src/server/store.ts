import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "@/domain/types";
import { buildSeed, DB_VERSION } from "@/mock/seed";

/**
 * MOCK REPOSITORY — a JSON file in .data/ plus an in-memory copy.
 *
 * `transaction()` runs a synchronous function against the database and then
 * persists it. Because Node runs it on one thread with no awaits in between,
 * the read-check-write is atomic for this single-process prototype — which is
 * how double-booking is prevented. PRODUCTION REPLACEMENT: a real database
 * with a transaction + row lock or exclusion constraint on (chair, time range).
 */

// DEMO_DATA_DIR lets a host point this at a persistent disk (e.g. Render's
// /var/data). Defaults to .data/ in the project folder.
const DATA_DIR = process.env.DEMO_DATA_DIR || path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "haircraft360-demo-db.json");

const g = globalThis as unknown as { __hc360db?: Database };

function load(): Database {
  if (g.__hc360db) return g.__hc360db;
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Database;
    if (parsed.version === DB_VERSION) {
      g.__hc360db = parsed;
      return parsed;
    }
  } catch {
    // Missing or unreadable file: fall through to seeding.
  }
  const seeded = buildSeed(Date.now());
  g.__hc360db = seeded;
  persist(seeded);
  return seeded;
}

function persist(db: Database): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch {
    // Read-only filesystem (e.g. serverless): keep data in memory only.
  }
}

/** Read-only snapshot. Callers must not mutate it. */
export function readDb(): Database {
  return load();
}

/** Atomic synchronous mutation. `fn` must not await. */
export function transaction<T>(fn: (db: Database) => T): T {
  const db = load();
  const draft = structuredClone(db);
  const result = fn(draft);
  g.__hc360db = draft;
  persist(draft);
  return result;
}

export function resetDatabase(): void {
  const seeded = buildSeed(Date.now());
  g.__hc360db = seeded;
  persist(seeded);
}
