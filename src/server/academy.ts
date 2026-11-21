import "server-only";
import { formatNaira } from "@/lib/money";
import { connection } from "next/server";
import { applicationStatusLabel, type ApplicationInput, type ApplicationStatus, type ExperienceLevel, type ProgramInput } from "@/domain/academy";
import { db } from "./db";
import { audit } from "./audit";
import { shortCode } from "./ids";
import { BookingError, type Actor } from "./booking-service";

/**
 * Locs Mastery: the programs the owner lists and the applications people send. Applying is
 * free; the salon follows up by phone, WhatsApp or email. Only basic personal details are kept.
 */

export interface ProgramRow {
  id: string;
  name: string;
  summary: string;
  duration: string;
  format: string;
  level: string;
  outcomes: string[];
  priceKobo: number | null;
  active: boolean;
  acceptingApplications: boolean;
  applicationCount: number;
}

export interface ApplicationRow {
  id: string;
  reference: string;
  programId: string;
  programName: string;
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  city: string;
  state: string;
  experience: ExperienceLevel;
  motivation: string;
  howHeard: string;
  marketingConsent: boolean;
  consentAt: string;
  status: ApplicationStatus;
  privateNote: string;
  createdAt: string;
  statusChangedAt: string | null;
}

type ProgramRecord = Awaited<ReturnType<typeof db.program.findFirstOrThrow>>;
const toProgram = (p: ProgramRecord & { _count?: { applications: number } }): ProgramRow => ({
  id: p.id,
  name: p.name,
  summary: p.summary,
  duration: p.duration,
  format: p.format,
  level: p.level,
  outcomes: p.outcomes,
  priceKobo: p.priceKobo,
  active: p.active,
  acceptingApplications: p.acceptingApplications,
  applicationCount: p._count?.applications ?? 0,
});

const applicationInclude = { program: { select: { name: true } } } as const;
type ApplicationRecord = Awaited<ReturnType<typeof db.programApplication.findFirstOrThrow<{ include: typeof applicationInclude }>>>;
const toApplication = (a: ApplicationRecord): ApplicationRow => ({
  id: a.id,
  reference: a.reference,
  programId: a.programId,
  programName: a.program.name,
  fullName: a.fullName,
  phone: a.phone,
  email: a.email,
  dateOfBirth: a.dateOfBirth.toISOString().slice(0, 10),
  city: a.city,
  state: a.state,
  experience: a.experience,
  motivation: a.motivation,
  howHeard: a.howHeard,
  marketingConsent: a.marketingConsent,
  consentAt: a.consentAt.toISOString(),
  status: a.status,
  privateNote: a.privateNote,
  createdAt: a.createdAt.toISOString(),
  statusChangedAt: a.statusChangedAt?.toISOString() ?? null,
});

/* ───────────── Public ───────────── */

/** Programs listed on /locs-mastery, in the owner's order. */
export async function listPublicPrograms(): Promise<ProgramRow[]> {
  await connection();
  const rows = await db.program.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map((p) => toProgram(p));
}

/** Programs open for applications right now: the only ones the form accepts. */
export async function openProgramIds(): Promise<string[]> {
  const rows = await db.program.findMany({ where: { active: true, acceptingApplications: true }, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * Records an application and queues two emails: a receipt to the applicant and a heads-up to
 * the owner. A second application for the same program from the same phone, while the first
 * is still open, is refused politely.
 */
export async function submitApplication(input: ApplicationInput, nowMs = Date.now()): Promise<{ reference: string; programName: string }> {
  return db.$transaction(async (tx) => {
    const program = await tx.program.findUnique({ where: { id: input.programId } });
    if (!program || !program.active || !program.acceptingApplications) {
      throw new BookingError("VALIDATION", "That program isn't taking applications right now.", { programId: "Choose a program that's open for applications." });
    }
    const open = await tx.programApplication.findFirst({ where: { programId: program.id, phone: input.phone, status: { in: ["new", "contacted"] } } });
    if (open) {
      throw new BookingError("NOT_ALLOWED", `You've already applied for ${program.name} with this phone number. We'll be in touch, so there's no need to apply again.`);
    }
    let reference = `LM-${shortCode(6)}`;
    while (await tx.programApplication.findUnique({ where: { reference } })) reference = `LM-${shortCode(6)}`;
    const now = new Date(nowMs);
    const app = await tx.programApplication.create({
      data: {
        reference,
        programId: program.id,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
        city: input.city,
        state: input.state,
        experience: input.experience,
        motivation: input.motivation,
        howHeard: input.howHeard,
        marketingConsent: input.marketingConsent,
        consentAt: now,
      },
    });
    await tx.notification.createMany({
      data: [
        { dedupeKey: `application:${app.id}`, type: "application_received", channel: "email", dueAt: now, payload: { applicationId: app.id } },
        {
          dedupeKey: `alert:application:${app.id}`,
          type: "owner_alert",
          channel: "email",
          dueAt: now,
          payload: { kind: "application", applicationId: app.id },
        },
      ],
    });
    await audit(tx, {
      action: "application.received",
      actorLabel: "Applicant",
      actorId: null,
      entityType: "ProgramApplication",
      entityId: app.id,
      summary: `Application ${reference} from ${input.fullName} for ${program.name}`,
    });
    return { reference, programName: program.name };
  });
}

/* ───────────── Admin: applications ───────────── */

export async function listApplications(filter: { status?: ApplicationStatus; programId?: string; q?: string } = {}): Promise<ApplicationRow[]> {
  const q = filter.q?.trim();
  const digits = q?.replace(/\D/g, "") ?? "";
  const rows = await db.programApplication.findMany({
    where: {
      ...(filter.status && { status: filter.status }),
      ...(filter.programId && { programId: filter.programId }),
      ...(q && {
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { reference: { contains: q.toUpperCase() } },
          // "0803 123 4567" finds "+2348031234567": compare without the leading 0.
          ...(digits.length >= 4 ? [{ phone: { contains: digits.replace(/^0/, "") } }] : []),
        ],
      }),
    },
    include: applicationInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toApplication);
}

export async function applicationCounts(): Promise<Record<ApplicationStatus, number>> {
  const groups = await db.programApplication.groupBy({ by: ["status"], _count: { _all: true } });
  const out = Object.fromEntries(Object.keys(applicationStatusLabel).map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  for (const g of groups) out[g.status] = g._count._all;
  return out;
}

export async function getApplication(id: string): Promise<ApplicationRow | null> {
  const row = await db.programApplication.findUnique({ where: { id }, include: applicationInclude });
  return row ? toApplication(row) : null;
}

export async function applicationActivity(id: string) {
  const rows = await db.auditLog.findMany({ where: { entityType: "ProgramApplication", entityId: id }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ id: r.id, summary: r.summary, actor: r.actorLabel, at: r.createdAt.toISOString() }));
}

export async function setApplicationStatus(id: string, status: ApplicationStatus, actor: Actor): Promise<void> {
  await db.$transaction(async (tx) => {
    const app = await tx.programApplication.findUnique({ where: { id } });
    if (!app) throw new BookingError("NOT_FOUND", "That application couldn't be found. Reload the page.");
    if (app.status === status) return;
    await tx.programApplication.update({ where: { id }, data: { status, statusChangedAt: new Date() } });
    await audit(tx, {
      action: "application.status",
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "ProgramApplication",
      entityId: id,
      summary: `Marked ${applicationStatusLabel[status].label.toLowerCase()} (was ${applicationStatusLabel[app.status].label.toLowerCase()})`,
    });
  });
}

export async function updateApplicationNote(id: string, note: string, actor: Actor): Promise<void> {
  await db.$transaction(async (tx) => {
    const app = await tx.programApplication.findUnique({ where: { id } });
    if (!app) throw new BookingError("NOT_FOUND", "That application couldn't be found. Reload the page.");
    await tx.programApplication.update({ where: { id }, data: { privateNote: note.trim().slice(0, 2000) } });
    await audit(tx, { action: "application.note", actorLabel: actor.label, actorId: actor.id, entityType: "ProgramApplication", entityId: id, summary: "Private note updated" });
  });
}

/* ───────────── Admin: programs (Settings) ───────────── */

export async function listPrograms(): Promise<ProgramRow[]> {
  const rows = await db.program.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { applications: true } } } });
  return rows.map(toProgram);
}

/** Adds a program at the end of the list, or saves changes to one. Programs with applications are hidden, never deleted. */
export async function saveProgram(id: string | null, input: ProgramInput, actor: Actor): Promise<void> {
  await db.$transaction(async (tx) => {
    if (!id) {
      const last = await tx.program.aggregate({ _max: { sortOrder: true } });
      const created = await tx.program.create({ data: { ...input, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
      await audit(tx, { action: "program.created", actorLabel: actor.label, actorId: actor.id, entityType: "Program", entityId: created.id, summary: `Program added: ${input.name}` });
      return;
    }
    const before = await tx.program.findUnique({ where: { id } });
    if (!before) throw new BookingError("NOT_FOUND", "That program couldn't be found. Reload the page.");
    await tx.program.update({ where: { id }, data: input });
    const notes = [
      before.active !== input.active && (input.active ? "shown on the page" : "hidden from the page"),
      before.acceptingApplications !== input.acceptingApplications && (input.acceptingApplications ? "opened for applications" : "closed for applications"),
      before.priceKobo !== input.priceKobo && (input.priceKobo === null ? "fee removed from the page" : `fee set to ${formatNaira(input.priceKobo)}`),
    ].filter(Boolean);
    await audit(tx, {
      action: "program.updated",
      actorLabel: actor.label,
      actorId: actor.id,
      entityType: "Program",
      entityId: id,
      summary: `Program ${input.name} updated${notes.length ? `: ${notes.join(", ")}` : ""}`,
    });
  });
}
