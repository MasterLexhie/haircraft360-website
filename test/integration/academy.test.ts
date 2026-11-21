import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDatabase } from "../db";
import { createSettings } from "../factories";
import type { EmailMessage } from "@/server/email/transport";
import type { ApplicationInput } from "@/domain/academy";

const mail = vi.hoisted(() => ({ sent: [] as EmailMessage[] }));
vi.mock("@/server/email/transport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/email/transport")>();
  return { ...actual, sendEmail: vi.fn(async (msg: EmailMessage) => (mail.sent.push(msg), { id: `fake_${mail.sent.length}` })) };
});
vi.mock("next/server", () => ({ connection: async () => {} }));

const { submitApplication, listPublicPrograms, openProgramIds, listApplications, setApplicationStatus, saveProgram, applicationCounts } = await import("@/server/academy");
const { sendDueNotifications } = await import("@/server/notifications");

const actor = { id: null, label: "Test admin" };
let open: string;
let closed: string;

const input = (over: Partial<ApplicationInput> = {}): ApplicationInput => ({
  programId: open,
  fullName: "Amaka Eze",
  phone: "+2348031234567",
  email: "amaka@example.com",
  dateOfBirth: "2000-05-14",
  city: "Ibadan",
  state: "Oyo",
  experience: "some",
  motivation: "I want to start locking hair for clients.",
  howHeard: "Instagram",
  marketingConsent: false,
  ...over,
});

beforeEach(async () => {
  vi.stubEnv("OWNER_NOTIFICATION_EMAIL", "owner@example.test");
  mail.sent = [];
  await resetDatabase();
  await createSettings();
  open = (await db.program.create({ data: { name: "Foundations", summary: "Start here", duration: "6 weeks", outcomes: ["Sectioning"], sortOrder: 1 } })).id;
  closed = (await db.program.create({ data: { name: "Advanced", summary: "Next step", duration: "4 weeks", outcomes: ["Repairs"], acceptingApplications: false, sortOrder: 2 } })).id;
  await db.program.create({ data: { name: "Hidden", summary: "Not listed", duration: "1 day", outcomes: ["x"], active: false } });
});

afterEach(() => vi.unstubAllEnvs());

describe("Locs Mastery programs", () => {
  it("lists shown programs in order, and only open ones take applications", async () => {
    expect((await listPublicPrograms()).map((p) => p.name)).toEqual(["Foundations", "Advanced"]);
    expect(await openProgramIds()).toEqual([open]);
  });

  it("records an application, emails the applicant and the owner, and logs it", async () => {
    const { reference, programName } = await submitApplication(input());
    expect(reference).toMatch(/^LM-[A-Z0-9]{6}$/);
    expect(programName).toBe("Foundations");
    const row = await db.programApplication.findUniqueOrThrow({ where: { reference } });
    expect(row).toMatchObject({ status: "new", fullName: "Amaka Eze" });
    expect(row.dateOfBirth.toISOString().slice(0, 10)).toBe("2000-05-14");
    expect(await db.auditLog.count({ where: { action: "application.received", entityId: row.id } })).toBe(1);

    await sendDueNotifications();
    const to = mail.sent.map((m) => m.to).sort();
    expect(to).toEqual(["amaka@example.com", "owner@example.test"]);
    const receipt = mail.sent.find((m) => m.to === "amaka@example.com")!;
    expect(receipt.subject).toBe("Application received: Foundations");
    expect(receipt.text).toContain(reference);
    expect(mail.sent.find((m) => m.to === "owner@example.test")!.text).toContain(`/admin/applications/${row.id}`);
  });

  it("refuses a closed program and a second open application from the same phone", async () => {
    await expect(submitApplication(input({ programId: closed }))).rejects.toMatchObject({ code: "VALIDATION" });
    await submitApplication(input());
    await expect(submitApplication(input({ email: "other@example.com" }))).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });

  it("allows applying again once the earlier application is decided", async () => {
    const { reference } = await submitApplication(input());
    const app = await db.programApplication.findUniqueOrThrow({ where: { reference } });
    await setApplicationStatus(app.id, "declined", actor);
    await expect(submitApplication(input())).resolves.toMatchObject({ programName: "Foundations" });
  });
});

describe("admin", () => {
  it("filters and searches, by phone as typed too", async () => {
    await submitApplication(input());
    await submitApplication(input({ fullName: "Tunde Bello", phone: "+2348099990000", email: "tunde@example.com" }));
    expect((await listApplications({ q: "tunde" })).map((a) => a.fullName)).toEqual(["Tunde Bello"]);
    expect((await listApplications({ q: "0803 123 4567" })).map((a) => a.fullName)).toEqual(["Amaka Eze"]);
    const amaka = (await listApplications({ q: "amaka" }))[0]!;
    await setApplicationStatus(amaka.id, "accepted", actor);
    expect((await listApplications({ status: "accepted" })).map((a) => a.fullName)).toEqual(["Amaka Eze"]);
    expect(await applicationCounts()).toMatchObject({ new: 1, accepted: 1, declined: 0 });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "application.status" } })).summary).toBe("Marked accepted (was new)");
  });

  it("adds a program at the end and records opening or closing it", async () => {
    await saveProgram(null, { name: "Styling", summary: "Styles", duration: "2 weeks", format: "", level: "", outcomes: ["Updos"], active: true, acceptingApplications: true }, actor);
    expect((await listPublicPrograms()).at(-1)?.name).toBe("Styling");
    await saveProgram(closed, { name: "Advanced", summary: "Next step", duration: "4 weeks", format: "", level: "", outcomes: ["Repairs"], active: true, acceptingApplications: true }, actor);
    expect(await openProgramIds()).toHaveLength(3);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "program.updated" } })).summary).toBe("Program Advanced updated: opened for applications");
  });
});
