import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

/**
 * Fixed-window rate limiting stored in Postgres (RateLimitBucket), so every server
 * instance shares the same counts. In-memory counters would not survive on
 * Workers or Netlify, where each request may hit a different instance.
 *
 * Volume is tiny (a salon), so one upsert per limited request is cheap.
 */

export interface Limit {
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
}

export const LIMITS = {
  /** Failed sign-in attempts (password or code) per IP. Successful steps do not count. */
  loginFailuresPerIp: { limit: 5, windowSeconds: 15 * 60 },
  bookingPerIp: { limit: 5, windowSeconds: 10 * 60 },
  paymentInitPerIp: { limit: 10, windowSeconds: 10 * 60 },
  /** Checks after the popup closes. A few per payment, so this is generous. */
  paymentVerifyPerIp: { limit: 30, windowSeconds: 10 * 60 },
  findBookingPerIp: { limit: 10, windowSeconds: 15 * 60 },
  /** Badly signed webhook calls we still store as evidence; past this they are refused unstored. */
  webhookBadSignaturePerIp: { limit: 20, windowSeconds: 60 * 60 },
} satisfies Record<string, Limit>;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Counts this request against `key` and says whether it is allowed. */
export async function hit(key: string, { limit, windowSeconds }: Limit, nowMs = Date.now()): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "expiresAt")
    VALUES (${key}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);

  // Occasional cleanup of finished windows; no scheduler needed.
  if (Math.random() < 0.02) await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(nowMs) } } });

  return {
    ok: count <= limit,
    remaining: Math.max(limit - count, 0),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - nowMs) / 1000)),
  };
}

/** Checks a key without counting this request (used where only failures should count). */
export async function peek(key: string, { limit, windowSeconds }: Limit, nowMs = Date.now()): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);
  const row = await db.rateLimitBucket.findUnique({ where: { key_windowStart: { key, windowStart } } });
  const count = row?.count ?? 0;
  return {
    ok: count < limit,
    remaining: Math.max(limit - count, 0),
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - nowMs) / 1000)),
  };
}

/**
 * The visitor's IP address. Cloudflare and Netlify set these headers at the edge;
 * locally there is none, so everyone shares the "local" bucket.
 */
export function clientIpFrom(h: Headers): string {
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const netlify = h.get("x-nf-client-connection-ip");
  if (netlify) return netlify.trim();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "local";
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

/** "Please try again in 4 minutes." */
export function retryMessage(seconds: number): string {
  if (seconds < 90) return "Please wait a minute and try again.";
  return `Please try again in ${Math.ceil(seconds / 60)} minutes.`;
}
