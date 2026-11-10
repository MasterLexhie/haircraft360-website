import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DEMO_ADMIN } from "@/mock/demo-config";

/** Demo-only signing secret. Override with DEMO_SESSION_SECRET; never ship a constant secret to production. */
const DEMO_SESSION_SECRET = process.env.DEMO_SESSION_SECRET ?? "haircraft360-demo-only-secret";

/**
 * DEMO AUTHENTICATION — NOT PRODUCTION SECURITY.
 * One hard-coded demo owner and an HMAC-signed cookie. A real build needs a
 * proper identity provider, hashed credentials, rate limiting, MFA, session
 * rotation and server-side authorisation on every admin action.
 */

export const SESSION_COOKIE = "hc360_demo_admin";
const MAX_AGE_S = 60 * 60 * 8;

function sign(payload: string): string {
  return createHmac("sha256", DEMO_SESSION_SECRET).update(payload).digest("base64url");
}

export function createSessionValue(nowMs = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ sub: DEMO_ADMIN.email, exp: nowMs + MAX_AGE_S * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function checkDemoCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === DEMO_ADMIN.email && password === DEMO_ADMIN.password;
}

export async function setSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Call at the top of every admin page and admin server action. */
export async function requireAdmin(): Promise<{ name: string }> {
  await connection(); // session expiry checks the clock: request time only
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySessionValue(value)) redirect("/admin/login");
  return { name: DEMO_ADMIN.displayName };
}
