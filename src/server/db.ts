import "server-only";
import { pgAdapter } from "@/lib/pg-adapter";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * The single database client. Server code only.
 *
 * Connects through the `pg` driver adapter so the same code runs on Node and,
 * later, on Cloudflare Workers or Netlify (see docs/FINAL_PLAN.md, portability rules).
 * In production DATABASE_URL is Supabase's pooled (transaction mode) connection,
 * so only transaction-level advisory locks are used.
 */

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  return new PrismaClient({ adapter: pgAdapter(connectionString) });
}

const g = globalThis as unknown as { __hc360prisma?: PrismaClient };

/** Reused across hot reloads in development so connections are not leaked. */
export const db: PrismaClient = g.__hc360prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.__hc360prisma = db;

export type Db = PrismaClient;
/** The client handed to `db.$transaction(async (tx) => ...)` callbacks. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
