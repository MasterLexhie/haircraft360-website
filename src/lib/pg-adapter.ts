import { PrismaPg } from "@prisma/adapter-pg";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

/**
 * The Prisma driver adapter for every database connection (app, seed, admin script, tests).
 *
 * The pg adapter reads `timestamptz` values as if the database session were in UTC: it drops
 * the offset Postgres sends. Supabase sessions are UTC, but a local Postgres takes the
 * computer's timezone (DBngin on a Mac in Lagos uses Africa/Lagos), which silently shifts
 * every stored time by an hour. Local connections therefore ask for UTC explicitly.
 * Remote connections get no startup options, because some connection poolers reject them;
 * the hosting checklist confirms the production database reports UTC.
 */
export function pgAdapter(connectionString: string): PrismaPg {
  const host = new URL(connectionString).hostname;
  return LOCAL_HOSTS.includes(host) ? new PrismaPg({ connectionString, options: "-c timezone=UTC" }) : new PrismaPg({ connectionString });
}
