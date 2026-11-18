import { config } from "dotenv";

/**
 * Resolves the test database URL and refuses anything that could hold real data:
 * it must be on this machine (or the CI service container) and must not be the dev database.
 */
export function testDatabaseUrl(): string {
  config({ path: [".env.local", ".env"], quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. See .env.example.");
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) {
    throw new Error(`TEST_DATABASE_URL must point at a local database, not "${parsed.hostname}".`);
  }
  if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === parsed.pathname && !process.env.CI) {
    throw new Error("TEST_DATABASE_URL must be a different database from DATABASE_URL; tests wipe it.");
  }
  return url;
}
