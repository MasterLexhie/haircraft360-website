import { beforeEach, describe, expect, it, vi } from "vitest";
import * as OTPAuth from "otpauth";
import { db, resetDatabase } from "../db";
import { hashPassword } from "@/lib/crypto";

/* A tiny cookie jar and request standing in for Next.js request APIs. */
const jar = new Map<string, string>();
let ip = "10.0.0.1";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers({ "x-forwarded-for": ip, "user-agent": "vitest" }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const auth = await import("@/server/auth");

const EMAIL = "owner@example.com";
const PASSWORD = "correct horse battery staple";

beforeEach(async () => {
  await resetDatabase();
  jar.clear();
  ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await db.adminUser.create({ data: { email: EMAIL, displayName: "Owner", passwordHash: await hashPassword(PASSWORD, 1000) } });
});

/** Signs in with the password and finishes 2FA setup; returns the TOTP generator and backup codes. */
async function signUpAndEnable() {
  expect(await auth.signInWithPassword(EMAIL, PASSWORD)).toBe("setup");
  const setup = await auth.beginTotpSetup();
  if (setup === "done") throw new Error("expected a pending setup");
  const { secret } = setup;
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: "SHA1" });
  const codes = await auth.confirmTotpSetup(totp.generate());
  return { totp, codes };
}

describe("password step", () => {
  it("gives the same answer for an unknown email and a wrong password", async () => {
    await expect(auth.signInWithPassword("nobody@example.com", PASSWORD)).rejects.toThrow(/don't match/);
    await expect(auth.signInWithPassword(EMAIL, "wrong password")).rejects.toThrow(/don't match/);
  });

  it("makes the account wait after five failures, then lets the right password in once the wait is over", async () => {
    for (let i = 0; i < 5; i++) {
      ip = `10.1.0.${i}`; // spread across IPs so the per-account rule is what triggers
      await expect(auth.signInWithPassword(EMAIL, "wrong password")).rejects.toThrow(/don't match/);
    }
    ip = "10.1.0.99";
    await expect(auth.signInWithPassword(EMAIL, PASSWORD)).rejects.toThrow(/Too many failed attempts/);
    await db.adminUser.update({ where: { email: EMAIL }, data: { loginBlockedUntil: new Date(Date.now() - 1000) } });
    expect(await auth.signInWithPassword(EMAIL, PASSWORD)).toBe("setup");
  });

  it("limits attempts from one IP", async () => {
    for (let i = 0; i < 5; i++) await expect(auth.signInWithPassword(`x${i}@example.com`, "nope")).rejects.toThrow(/don't match/);
    await expect(auth.signInWithPassword(EMAIL, PASSWORD)).rejects.toThrow(/Too many sign-in attempts/);
  });

  it("does not open the admin until two-factor is done", async () => {
    await auth.signInWithPassword(EMAIL, PASSWORD);
    await expect(auth.requireAdmin()).rejects.toThrow("REDIRECT:/admin/login/setup");
  });
});

describe("two-factor sign-in", () => {
  it("stores the authenticator secret encrypted and turns 2FA on with ten backup codes", async () => {
    const { codes } = await signUpAndEnable();
    expect(codes).toHaveLength(10);
    const user = await db.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.totpEnabledAt).not.toBeNull();
    expect(user.totpSecret).toMatch(/^v1\./);
    expect(user.backupCodeHashes).toHaveLength(10);
    expect(user.backupCodeHashes).not.toContain(codes[0]);
    expect(await auth.requireAdmin()).toMatchObject({ email: EMAIL, name: "Owner" });
  });

  it("asks returning admins for a code, and never accepts the same code twice", async () => {
    const { totp } = await signUpAndEnable();
    await auth.logout();
    expect(await auth.signInWithPassword(EMAIL, PASSWORD)).toBe("verify");
    await expect(auth.requireAdmin()).rejects.toThrow("REDIRECT:/admin/login/verify");
    // The setup already used the current code, so it must be refused now.
    await expect(auth.verifySecondFactor(totp.generate())).rejects.toThrow(/didn't work/);
  });

  it("accepts each backup code once", async () => {
    const { codes } = await signUpAndEnable();
    await auth.logout();
    await auth.signInWithPassword(EMAIL, PASSWORD);
    await auth.verifySecondFactor(codes[0].toLowerCase());
    expect(await auth.requireAdmin()).toMatchObject({ email: EMAIL });
    await auth.logout();
    await auth.signInWithPassword(EMAIL, PASSWORD);
    await expect(auth.verifySecondFactor(codes[0])).rejects.toThrow(/didn't work/);
  });

  it("queues one owner alert per hour, however many sign-ins happen", async () => {
    const { codes } = await signUpAndEnable();
    await auth.logout();
    await auth.signInWithPassword(EMAIL, PASSWORD);
    await auth.verifySecondFactor(codes[1]);
    const alerts = await db.notification.findMany({ where: { type: "owner_alert" } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].payload).toMatchObject({ kind: "new_sign_in", account: EMAIL });
  });
});

describe("sessions", () => {
  it("logout ends the session in the database, not just the cookie", async () => {
    await signUpAndEnable();
    const token = [...jar.values()][0];
    await auth.logout();
    jar.set(auth.SESSION_COOKIE, token); // an attacker replaying the old cookie
    await expect(auth.requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("changing the password signs out every other device", async () => {
    await signUpAndEnable();
    const admin = await auth.requireAdmin();
    const user = await db.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    await db.adminSession.create({ data: { tokenHash: "other-device", adminUserId: user.id, mfaVerified: true, expiresAt: new Date(Date.now() + 3_600_000) } });
    await auth.changePassword(admin, PASSWORD, "a brand new long password");
    expect(await db.adminSession.count({ where: { adminUserId: user.id } })).toBe(1);
    expect(await auth.requireAdmin()).toMatchObject({ email: EMAIL });
  });

  it("rejects a short new password", async () => {
    await signUpAndEnable();
    const admin = await auth.requireAdmin();
    await expect(auth.changePassword(admin, PASSWORD, "short")).rejects.toThrow(/at least 12/);
  });

  it("counts wrong current passwords on the Account page like failed sign-ins", async () => {
    await signUpAndEnable();
    const admin = await auth.requireAdmin();
    for (let i = 0; i < 5; i++) {
      ip = `10.2.0.${i}`; // spread across IPs so the per-account rule is what triggers
      await expect(auth.changePassword(admin, "wrong password", "a brand new long password")).rejects.toThrow(/isn't right/);
    }
    ip = "10.2.0.99";
    await expect(auth.changePassword(admin, PASSWORD, "a brand new long password")).rejects.toThrow(/Too many failed attempts/);
    const alerts = await db.notification.findMany({ where: { type: "owner_alert" } });
    expect(alerts.some((a) => (a.payload as { kind?: string }).kind === "failed_sign_ins")).toBe(true);
  });

  it("limits wrong current passwords from one IP", async () => {
    await signUpAndEnable();
    const admin = await auth.requireAdmin();
    for (let i = 0; i < 5; i++) await expect(auth.signInWithPassword(`x${i}@example.com`, "nope")).rejects.toThrow(/don't match/);
    await expect(auth.changePassword(admin, PASSWORD, "a brand new long password")).rejects.toThrow(/Too many sign-in attempts/);
  });

  it("clears the failure count after a successful change", async () => {
    await signUpAndEnable();
    const admin = await auth.requireAdmin();
    await expect(auth.changePassword(admin, "wrong password", "a brand new long password")).rejects.toThrow(/isn't right/);
    await auth.changePassword(admin, PASSWORD, "a brand new long password");
    const user = await db.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.failedLoginCount).toBe(0);
  });
});
