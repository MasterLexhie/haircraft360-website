/**
 * Admin account tool for the developer (task S2). There is no password reset by
 * email, so this is how a forgotten password or a lost phone is handled.
 *
 *   npm run admin -- list
 *   npm run admin -- create owner@example.com "Salon owner"
 *   npm run admin -- reset-password owner@example.com
 *   npm run admin -- reset-2fa owner@example.com
 *
 * New passwords are generated and printed once; share them with the owner privately.
 * Every reset signs the account out everywhere. Uses DATABASE_URL, so it works on
 * production when run with the production connection string; it asks before
 * touching any database that isn't on this machine.
 */
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, randomToken } from "../src/lib/crypto";

config({ path: [".env.local", ".env"], quiet: true });

const USAGE = `Usage:
  npm run admin -- list
  npm run admin -- create <email> "<display name>"
  npm run admin -- reset-password <email>
  npm run admin -- reset-2fa <email>`;

/** Long enough to be safe, easy enough to read out over the phone. */
const newPassword = () => randomToken(12).replace(/[-_]/g, "x");

async function confirmTarget(url: string): Promise<void> {
  const host = new URL(url).hostname;
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`This changes the database at ${host}. Type "yes" to continue: `);
  rl.close();
  if (answer.trim() !== "yes") throw new Error("Cancelled.");
}

async function main() {
  const [command, emailRaw, name] = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  if (!command) throw new Error(USAGE);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    if (command === "list") {
      const users = await db.adminUser.findMany({ orderBy: { createdAt: "asc" } });
      for (const u of users) {
        console.log(`${u.email}  ${u.displayName}  2FA: ${u.totpEnabledAt ? "on" : "not set up"}  backup codes: ${u.backupCodeHashes.length}  last sign-in: ${u.lastLoginAt?.toISOString() ?? "never"}`);
      }
      if (!users.length) console.log("No admin accounts yet.");
      return;
    }

    const email = emailRaw?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Give an email address.\n${USAGE}`);
    await confirmTarget(url);

    if (command === "create") {
      if (!name?.trim()) throw new Error(`Give a display name.\n${USAGE}`);
      const password = newPassword();
      await db.adminUser.create({ data: { email, displayName: name.trim(), passwordHash: await hashPassword(password) } });
      await db.auditLog.create({ data: { actorLabel: "Developer", action: "auth.admin_created", entityType: "AdminUser", summary: `Admin account created for ${email}` } });
      console.log(`Created ${email}. Temporary password (shown once): ${password}`);
      console.log("They will set up two-factor sign-in the first time they sign in, then should change this password under Account.");
      return;
    }

    const user = await db.adminUser.findUnique({ where: { email } });
    if (!user) throw new Error(`No admin account for ${email}.`);

    if (command === "reset-password") {
      const password = newPassword();
      await db.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginCount: 0, loginBlockedUntil: null } });
      await db.adminSession.deleteMany({ where: { adminUserId: user.id } });
      await db.auditLog.create({ data: { actorLabel: "Developer", action: "auth.password_reset", entityType: "AdminUser", entityId: user.id, summary: "Password reset by the developer; signed out everywhere" } });
      console.log(`New temporary password for ${email} (shown once): ${password}`);
      return;
    }

    if (command === "reset-2fa") {
      await db.adminUser.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null, backupCodeHashes: [], lastTotpStep: null, failedLoginCount: 0, loginBlockedUntil: null } });
      await db.adminSession.deleteMany({ where: { adminUserId: user.id } });
      await db.auditLog.create({ data: { actorLabel: "Developer", action: "auth.2fa_reset", entityType: "AdminUser", entityId: user.id, summary: "Two-factor sign-in reset by the developer; signed out everywhere" } });
      console.log(`Two-factor sign-in cleared for ${email}. They will set it up again at their next sign-in.`);
      return;
    }

    throw new Error(`Unknown command "${command}".\n${USAGE}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
