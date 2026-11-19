import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import * as OTPAuth from "otpauth";
import { decryptString, encryptString, hashPassword, randomToken, sha256Hex, timingSafeEqual, verifyPassword } from "@/lib/crypto";
import { db } from "./db";
import { shortCode } from "./ids";
import { clientIpFrom, hit, LIMITS, peek, retryMessage } from "./rate-limit";
import { queueSecurityAlert } from "./security-alerts";

/**
 * Admin authentication (decision D3: small, in-house, no auth library).
 *
 * - Passwords: PBKDF2 through Web Crypto (src/lib/crypto.ts), minimum 12 characters.
 * - Sessions: a random token in an httpOnly, Secure, SameSite=Lax cookie; only its
 *   SHA-256 hash is stored (AdminSession). A new session is issued at each step of
 *   sign-in, and logout or a password change deletes sessions from the database.
 * - Two-factor sign-in is required: an authenticator app code, or a one-time backup code.
 * - Failed sign-ins are limited per IP and per account; after 5 failures the wait grows, but there
 *   is never a permanent lockout, so nobody can lock the owner out for good.
 * - Every admin page and server action calls requireAdmin(); proxy.ts only checks the
 *   cookie exists, as a fast first filter.
 */

import { REQUEST_PATH_HEADER, SESSION_COOKIE_NAME } from "./session-cookie";

export const SESSION_COOKIE = SESSION_COOKIE_NAME;
const SESSION_HOURS = 8;
const PENDING_MINUTES = 10;
export const MIN_PASSWORD_LENGTH = 12;
const FREE_FAILURES = 5;
const MAX_WAIT_SECONDS = 15 * 60;
const TOTP_PURPOSE = "admin-totp-secret";

/** A hash of a throwaway value, so an unknown email takes as long to check as a real one. */
const DUMMY_HASH = "pbkdf2-sha256$600000$iBWHJDxSINh9HchQd8DOlg$dbY-plhO-IjKb27zbKtdNzsK699rWiplfgmNHbr0_2k";

export interface AdminIdentity {
  id: string;
  name: string;
  email: string;
}

export class AuthError extends Error {}

function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  return s;
}

/* ───────────────────────────── Sessions ───────────────────────────── */

async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function requestMeta() {
  const h = await headers();
  return { ip: clientIpFrom(h), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

/** Creates a session and replaces any session the browser already had. */
async function startSession(adminUserId: string, mfaVerified: boolean): Promise<void> {
  await endCurrentSession();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + (mfaVerified ? SESSION_HOURS * 3_600_000 : PENDING_MINUTES * 60_000));
  const { ip, userAgent } = await requestMeta();
  await db.adminSession.create({ data: { tokenHash: await sha256Hex(token), adminUserId, mfaVerified, ip, userAgent, expiresAt } });
  await setSessionCookie(token, expiresAt);
}

async function currentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.adminSession.findUnique({ where: { tokenHash: await sha256Hex(token) }, include: { adminUser: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
}

async function endCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: await sha256Hex(token) } });
}

/**
 * Call at the top of every admin page and admin server action.
 * Sends the visitor to sign-in, or to the 2FA step they still owe.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  await connection();
  const session = await currentSession();
  if (!session) redirect(await loginUrl());
  if (!session.mfaVerified) redirect(session.adminUser.totpEnabledAt ? "/admin/login/verify" : "/admin/login/setup");
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  const u = session.adminUser;
  return { id: u.id, name: u.displayName, email: u.email };
}

/** The sign-in page, with the page being opened as ?next= (checked again by safeNext on sign-in). */
async function loginUrl(): Promise<string> {
  const path = (await headers()).get(REQUEST_PATH_HEADER) ?? "";
  const keep = path.startsWith("/admin") && path !== "/admin" && !path.startsWith("/admin/login") && !path.startsWith("//");
  return keep ? `/admin/login?next=${encodeURIComponent(path)}` : "/admin/login";
}

/** For the 2FA steps: a session that has passed the password but not the code. */
export async function requirePendingSession() {
  await connection();
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  if (session.mfaVerified) redirect("/admin");
  return session;
}

export async function logout(): Promise<void> {
  await endCurrentSession();
  (await cookies()).delete(SESSION_COOKIE);
}

/* ───────────────────────────── Throttling ───────────────────────────── */

function waitAfter(failures: number): number {
  if (failures < FREE_FAILURES) return 0;
  return Math.min(30 * 2 ** (failures - FREE_FAILURES), MAX_WAIT_SECONDS);
}

async function checkIpLimit(): Promise<void> {
  const { ip } = await requestMeta();
  const limit = await peek(`login-fail:ip:${ip}`, LIMITS.loginFailuresPerIp);
  if (!limit.ok) throw new AuthError(`Too many sign-in attempts. ${retryMessage(limit.retryAfterSeconds)}`);
}

async function countIpFailure(): Promise<void> {
  const { ip } = await requestMeta();
  await hit(`login-fail:ip:${ip}`, LIMITS.loginFailuresPerIp);
}

function assertNotWaiting(user: { loginBlockedUntil: Date | null }) {
  const until = user.loginBlockedUntil?.getTime() ?? 0;
  if (until > Date.now()) throw new AuthError(`Too many failed attempts on this account. ${retryMessage(Math.ceil((until - Date.now()) / 1000))}`);
}

async function recordFailure(user: { id: string; email: string; failedLoginCount: number }) {
  await countIpFailure();
  const failures = user.failedLoginCount + 1;
  const wait = waitAfter(failures);
  await db.adminUser.update({
    where: { id: user.id },
    data: { failedLoginCount: failures, loginBlockedUntil: wait ? new Date(Date.now() + wait * 1000) : null },
  });
  if (failures >= FREE_FAILURES) {
    await queueSecurityAlert("failed_sign_ins", user.email, `${failures} failed sign-in attempts on ${user.email}. If this wasn't you, contact your developer.`);
  }
}

/* ───────────────────────────── Step 1: password ───────────────────────────── */

/** Returns where to go next: the 2FA code page, or 2FA setup for a first sign-in. */
export async function signInWithPassword(emailRaw: string, password: string): Promise<"verify" | "setup"> {
  await checkIpLimit();
  const email = emailRaw.trim().toLowerCase();
  const user = email ? await db.adminUser.findUnique({ where: { email } }) : null;
  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    await countIpFailure();
    throw new AuthError("That email and password don't match an admin account.");
  }
  assertNotWaiting(user);
  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordFailure(user);
    throw new AuthError("That email and password don't match an admin account.");
  }
  await startSession(user.id, false);
  return user.totpEnabledAt ? "verify" : "setup";
}

/* ───────────────────────────── Step 2: two-factor ───────────────────────────── */

function totpFor(secretBase32: string, email: string) {
  return new OTPAuth.TOTP({ issuer: "Haircraft 360", label: email, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secretBase32) });
}

/** Accepts the current code (with 30 seconds of clock drift either way), never the same code twice. */
function acceptedStep(totp: OTPAuth.TOTP, code: string, lastStep: number | null): number | null {
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 30_000) + delta;
  return lastStep !== null && step <= lastStep ? null : step;
}

const normaliseBackupCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function completeSignIn(userId: string, email: string) {
  await db.adminUser.update({ where: { id: userId }, data: { failedLoginCount: 0, loginBlockedUntil: null, lastLoginAt: new Date() } });
  await startSession(userId, true);
  const { ip } = await requestMeta();
  await db.auditLog.create({ data: { actorId: userId, actorLabel: email, action: "auth.signed_in", entityType: "AdminUser", entityId: userId, summary: `Signed in from ${ip}` } });
  await queueSecurityAlert("new_sign_in", email, `New sign-in to the salon admin as ${email} from ${ip}. If this wasn't you, contact your developer.`);
}

/** Verifies an authenticator code or a backup code for the pending session. */
export async function verifySecondFactor(codeRaw: string): Promise<void> {
  await checkIpLimit();
  const session = await requirePendingSession();
  const user = session.adminUser;
  if (!user.totpSecret || !user.totpEnabledAt) throw new AuthError("Two-factor sign-in isn't set up yet.");
  assertNotWaiting(user);

  const code = codeRaw.trim();
  if (/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    const secret = await decryptString(user.totpSecret, authSecret(), TOTP_PURPOSE);
    const step = acceptedStep(totpFor(secret, user.email), code.replace(/\s/g, ""), user.lastTotpStep);
    if (step === null) {
      await recordFailure(user);
      throw new AuthError("That code didn't work. Check the time on your phone and try the newest code.");
    }
    await db.adminUser.update({ where: { id: user.id }, data: { lastTotpStep: step } });
  } else {
    const hash = await sha256Hex(normaliseBackupCode(code));
    const match = user.backupCodeHashes.find((h) => timingSafeEqual(h, hash));
    if (!match) {
      await recordFailure(user);
      throw new AuthError("That code didn't work. Enter the 6-digit code from your app, or one of your backup codes.");
    }
    await db.adminUser.update({ where: { id: user.id }, data: { backupCodeHashes: user.backupCodeHashes.filter((h) => h !== match) } });
  }
  await completeSignIn(user.id, user.email);
}

/* ───────────────────────────── Two-factor setup ───────────────────────────── */

/**
 * For the setup page: creates (or reuses) the pending secret and returns what to show.
 * Returns "done" (instead of redirecting) once setup is finished, because the page
 * re-renders right after the confirm action and must stay put to show the backup codes.
 */
export async function beginTotpSetup(): Promise<{ uri: string; secret: string } | "done"> {
  await connection();
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  const user = session.adminUser;
  if (session.mfaVerified) return "done";
  if (user.totpEnabledAt) redirect("/admin/login/verify");
  let secret: string;
  if (user.totpSecret) {
    secret = await decryptString(user.totpSecret, authSecret(), TOTP_PURPOSE);
  } else {
    secret = new OTPAuth.Secret({ size: 20 }).base32;
    await db.adminUser.update({ where: { id: user.id }, data: { totpSecret: await encryptString(secret, authSecret(), TOTP_PURPOSE) } });
  }
  return { uri: totpFor(secret, user.email).toString(), secret };
}

function newBackupCodes(): string[] {
  return Array.from({ length: 10 }, () => `${shortCode(4)}-${shortCode(4)}`);
}

async function storeBackupCodes(userId: string, codes: string[]) {
  const hashes = await Promise.all(codes.map((c) => sha256Hex(normaliseBackupCode(c))));
  await db.adminUser.update({ where: { id: userId }, data: { backupCodeHashes: hashes } });
}

/** Confirms the first code from the app, switches 2FA on and returns backup codes to show once. */
export async function confirmTotpSetup(codeRaw: string): Promise<string[]> {
  await checkIpLimit();
  const session = await requirePendingSession();
  const user = session.adminUser;
  if (user.totpEnabledAt || !user.totpSecret) throw new AuthError("Start the setup again.");
  const secret = await decryptString(user.totpSecret, authSecret(), TOTP_PURPOSE);
  const step = acceptedStep(totpFor(secret, user.email), codeRaw.replace(/\s/g, ""), null);
  if (step === null) {
    await countIpFailure();
    throw new AuthError("That code didn't match. Check the time on your phone and enter the newest code.");
  }
  await db.adminUser.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), lastTotpStep: step } });
  const codes = newBackupCodes();
  await storeBackupCodes(user.id, codes);
  await db.auditLog.create({ data: { actorId: user.id, actorLabel: user.email, action: "auth.2fa_enabled", entityType: "AdminUser", entityId: user.id, summary: "Two-factor sign-in switched on" } });
  await completeSignIn(user.id, user.email);
  return codes;
}

/* ───────────────────────────── Account management ───────────────────────────── */

export async function changePassword(admin: AdminIdentity, current: string, next: string): Promise<void> {
  if (next.length < MIN_PASSWORD_LENGTH) throw new AuthError(`Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`);
  // Wrong current passwords count toward the same limits as sign-in, so someone at an
  // unlocked, signed-in device can't keep guessing.
  await checkIpLimit();
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
  assertNotWaiting(user);
  if (!(await verifyPassword(current, user.passwordHash))) {
    await recordFailure(user);
    throw new AuthError("Your current password isn't right.");
  }
  await db.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date(), failedLoginCount: 0, loginBlockedUntil: null } });
  // End every session, then start a fresh one here so the owner stays signed in on this device.
  await db.adminSession.deleteMany({ where: { adminUserId: user.id } });
  await startSession(user.id, true);
  await db.auditLog.create({ data: { actorId: user.id, actorLabel: admin.name, action: "auth.password_changed", entityType: "AdminUser", entityId: user.id, summary: "Password changed; all other sessions signed out" } });
}

export async function signOutEverywhere(admin: AdminIdentity): Promise<void> {
  await db.adminSession.deleteMany({ where: { adminUserId: admin.id } });
  (await cookies()).delete(SESSION_COOKIE);
  await db.auditLog.create({ data: { actorId: admin.id, actorLabel: admin.name, action: "auth.signed_out_everywhere", entityType: "AdminUser", entityId: admin.id, summary: "Signed out on every device" } });
}

export async function regenerateBackupCodes(admin: AdminIdentity): Promise<string[]> {
  const codes = newBackupCodes();
  await storeBackupCodes(admin.id, codes);
  await db.auditLog.create({ data: { actorId: admin.id, actorLabel: admin.name, action: "auth.backup_codes_replaced", entityType: "AdminUser", entityId: admin.id, summary: "New backup codes created; old ones stopped working" } });
  return codes;
}

export async function accountSummary(admin: AdminIdentity) {
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
  const sessions = await db.adminSession.count({ where: { adminUserId: admin.id, mfaVerified: true, expiresAt: { gt: new Date() } } });
  return { backupCodesLeft: user.backupCodeHashes.length, activeSessions: sessions, passwordChangedAt: user.passwordChangedAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null };
}
