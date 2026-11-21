import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "../db";
import { DEFAULT_MESSAGE_TEMPLATES, DEFAULT_WEEKLY_HOURS } from "@/domain/settings";

const { loadSettings } = await import("@/server/settings");

beforeEach(async () => {
  await resetDatabase();
});

describe("settings on a brand-new database", () => {
  it("creates the starting settings on first use and notes it once", async () => {
    const s = await loadSettings();
    expect(s.availability.weeklyHours).toEqual(DEFAULT_WEEKLY_HOURS);
    expect(s.messageTemplates).toEqual(DEFAULT_MESSAGE_TEMPLATES);
    await loadSettings();
    expect(await db.settings.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: "settings.created" } })).toBe(1);
  });

  it("copes with several first requests at once", async () => {
    const all = await Promise.all(Array.from({ length: 5 }, () => loadSettings()));
    expect(new Set(all.map((s) => JSON.stringify(s))).size).toBe(1);
    expect(await db.settings.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: "settings.created" } })).toBe(1);
  });

  it("leaves existing settings alone", async () => {
    await loadSettings();
    await db.settings.update({ where: { id: 1 }, data: { holdMinutes: 25 } });
    expect((await loadSettings()).availability.holdMinutes).toBe(25);
    expect(await db.auditLog.count({ where: { action: "settings.created" } })).toBe(1);
  });
});
