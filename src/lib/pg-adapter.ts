import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];
/** Settings in the connection string override the `ssl` option in pg, so they're removed when we set it. */
const SSL_URL_PARAMS = ["sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"];

/**
 * Connection settings for one database URL.
 *
 * Local: the pg adapter reads `timestamptz` values as if the session were in UTC, but a local
 * Postgres takes the computer's timezone (DBngin on a Mac in Lagos uses Africa/Lagos), which
 * would shift every stored time by an hour. Local connections therefore ask for UTC explicitly.
 *
 * Remote (Supabase): no startup options, because connection poolers reject them. With
 * `caCert` (DATABASE_CA_CERT, Supabase's CA certificate) the connection is encrypted *and* the
 * server's certificate is checked, so nobody in between can pretend to be the database.
 */
export function pgConfig(connectionString: string, caCert: string | undefined): PoolConfig {
  const url = new URL(connectionString);
  if (LOCAL_HOSTS.includes(url.hostname)) return { connectionString, options: "-c timezone=UTC" };
  const ca = caCert?.trim().replace(/\\n/g, "\n");
  if (!ca) return { connectionString };
  for (const p of SSL_URL_PARAMS) url.searchParams.delete(p);
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}

/** The Prisma driver adapter for every database connection (app, seed, admin script, tests). */
export function pgAdapter(connectionString: string): PrismaPg {
  return new PrismaPg(pgConfig(connectionString, process.env.DATABASE_CA_CERT));
}
