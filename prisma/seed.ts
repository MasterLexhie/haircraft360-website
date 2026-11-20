/**
 * Local development seed (BUILD_SPEC Section 12). Run with `npm run db:seed`.
 *
 * - Clearly fake data: sample services and add-ons, placeholder settings, about 30
 *   customers (some phone-only, some with several phones or emails, some near-duplicate
 *   names), bookings in every status, payments of every type, expenses in every category.
 * - Safe to rerun: fixed IDs with the prefix `seed_`; earlier seed rows are replaced,
 *   anything you created by hand is left alone.
 * - Refuses to run unless DATABASE_URL points at this machine. Production never gets this data.
 */
import { config } from "dotenv";
import { pgAdapter } from "../src/lib/pg-adapter";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { addDays, lagosDateKey, lagosToUtcMs } from "../src/lib/time";
import { hashPassword, randomToken, sha256Hex } from "../src/lib/crypto";
import { placeholderDomain, placeholderEmailFor } from "../src/domain/phone";
import { depositDue, type DepositRule } from "../src/domain/deposit";
import {
  DEFAULT_CAPACITY_BY_WEEKDAY,
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_SALON_DETAILS,
  DEFAULT_WEEKLY_HOURS,
} from "../src/domain/settings";

config({ path: [".env.local", ".env"], quiet: true });

/* ───────────────────────────── Safety guard ───────────────────────────── */

export function assertLocalDatabase(url: string | undefined): string {
  if (!url) throw new Error("DATABASE_URL is not set.");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to seed: database host "${host}" is not local. The seed is for development only.`);
  }
  return url;
}

/* ───────────────────────────── Helpers ───────────────────────────── */

/** Deterministic random numbers so every run produces the same data. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(360);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const naira = (n: number) => n * 100;
const MIN = 60_000;
const pad = (n: number, width = 3) => String(n).padStart(width, "0");
/** Fake but well-formed Nigerian mobile number in E.164. */
const fakePhone = (n: number) => `+234803555${pad(n, 4)}`;
const PLACEHOLDER_DOMAIN = placeholderDomain(process.env.NEXT_PUBLIC_SITE_URL);

/* ───────────────────────────── Reference data ───────────────────────────── */

const DEPOSIT_RULE: DepositRule = { type: "percent", fixedKobo: 0, percent: 30, scope: "full_total", minimumKobo: naira(2000) };

const EXPENSE_CATEGORIES = [
  "Supplies and products",
  "Rent",
  "Power and diesel",
  "Staff pay",
  "Equipment",
  "Marketing",
  "Repairs",
  "Other",
];

interface SeedService {
  id: string;
  name: string;
  description: string;
  priceKobo: number;
  durationMinutes: number;
  bookableAlone: boolean;
  availableAsAddOn: boolean;
  addOnPriceKobo?: number;
  addOnDurationMinutes?: number;
}

const SERVICES: SeedService[] = [
  { id: "seed_svc_starter", name: "Starter locs (sample)", description: "Sample service. Replace with the salon's real menu.", priceKobo: naira(45000), durationMinutes: 240, bookableAlone: true, availableAsAddOn: false },
  { id: "seed_svc_retwist", name: "Loc retwist (sample)", description: "Sample service. Replace with the salon's real menu.", priceKobo: naira(15000), durationMinutes: 120, bookableAlone: true, availableAsAddOn: false },
  { id: "seed_svc_repair", name: "Loc repair (sample)", description: "Sample service. Replace with the salon's real menu.", priceKobo: naira(20000), durationMinutes: 90, bookableAlone: true, availableAsAddOn: false },
  { id: "seed_svc_consult", name: "Consultation (sample)", description: "Sample service. Replace with the salon's real menu.", priceKobo: naira(5000), durationMinutes: 30, bookableAlone: true, availableAsAddOn: false },
  { id: "seed_svc_wash", name: "Wash and condition (sample add-on)", description: "Sample add-on.", priceKobo: naira(3000), durationMinutes: 30, bookableAlone: false, availableAsAddOn: true },
  { id: "seed_svc_scalp", name: "Scalp treatment (sample add-on)", description: "Sample add-on.", priceKobo: naira(5000), durationMinutes: 30, bookableAlone: false, availableAsAddOn: true },
  { id: "seed_svc_style", name: "Loc styling (sample)", description: "Sample service, also offered as an add-on.", priceKobo: naira(10000), durationMinutes: 60, bookableAlone: true, availableAsAddOn: true, addOnPriceKobo: naira(8000), addOnDurationMinutes: 45 },
];

const ADD_ONS: Record<string, string[]> = {
  seed_svc_starter: ["seed_svc_wash", "seed_svc_scalp"],
  seed_svc_retwist: ["seed_svc_wash", "seed_svc_scalp", "seed_svc_style"],
  seed_svc_repair: ["seed_svc_wash"],
};

const FIRST = ["Adaeze", "Tolu", "Chiamaka", "Bisi", "Kemi", "Ngozi", "Yemi", "Funke", "Ifeoma", "Sade", "Amaka", "Bola", "Dayo", "Ese", "Femi"];
const LAST = ["Okafor", "Adeyemi", "Balogun", "Eze", "Ojo", "Nwosu", "Bello", "Afolabi", "Ibe", "Lawal"];

/* ───────────────────────────── Main ───────────────────────────── */

async function main() {
  const url = assertLocalDatabase(process.env.DATABASE_URL);
  const db = new PrismaClient({ adapter: pgAdapter(url) });
  const nowMs = Date.now();
  const today = lagosDateKey(nowMs);

  try {
    // Settings (single row). Placeholder values until the client supplies real ones.
    const settingsData = {
      slotIntervalMinutes: 30,
      bufferMinutes: 15,
      holdMinutes: 15,
      minimumLeadMinutes: 120,
      bookingHorizonDays: 60,
      weeklyHours: DEFAULT_WEEKLY_HOURS,
      capacityByWeekday: DEFAULT_CAPACITY_BY_WEEKDAY,
      depositType: DEPOSIT_RULE.type,
      depositFixedKobo: DEPOSIT_RULE.fixedKobo,
      depositPercent: DEPOSIT_RULE.percent,
      depositScope: DEPOSIT_RULE.scope,
      depositMinimumKobo: DEPOSIT_RULE.minimumKobo,
      messageTemplates: DEFAULT_MESSAGE_TEMPLATES,
      salonDetails: DEFAULT_SALON_DETAILS,
      schedulerHeartbeat: new Date(nowMs - 20 * MIN),
    } satisfies Omit<Prisma.SettingsCreateInput, "id">;
    await db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...settingsData }, update: settingsData });

    const categories = await Promise.all(
      EXPENSE_CATEGORIES.map((name, i) =>
        db.expenseCategory.upsert({ where: { name }, create: { name, sortOrder: i }, update: { sortOrder: i } }),
      ),
    );

    // Admin user. The password comes from SEED_ADMIN_PASSWORD or is generated and printed once.
    const adminEmail = (process.env.SEED_ADMIN_EMAIL?.trim() || "owner@example.test").toLowerCase();
    const existingAdmin = await db.adminUser.findUnique({ where: { email: adminEmail } });
    let printedPassword: string | null = null;
    let admin = existingAdmin;
    if (!admin || process.env.SEED_ADMIN_PASSWORD) {
      const password = process.env.SEED_ADMIN_PASSWORD || randomToken(12);
      if (!process.env.SEED_ADMIN_PASSWORD) printedPassword = password;
      const passwordHash = await hashPassword(password);
      admin = await db.adminUser.upsert({
        where: { email: adminEmail },
        create: { email: adminEmail, displayName: "Salon owner (sample)", passwordHash },
        update: { passwordHash, passwordChangedAt: new Date() },
      });
    }

    for (const [i, s] of SERVICES.entries()) {
      const data = { ...s, sortOrder: i, active: true, addOnPriceKobo: s.addOnPriceKobo ?? null, addOnDurationMinutes: s.addOnDurationMinutes ?? null };
      await db.service.upsert({ where: { id: s.id }, create: data, update: data });
    }
    await db.serviceAddOn.deleteMany({ where: { mainServiceId: { startsWith: "seed_" } } });
    await db.serviceAddOn.createMany({
      data: Object.entries(ADD_ONS).flatMap(([mainServiceId, ids]) => ids.map((addOnServiceId) => ({ mainServiceId, addOnServiceId }))),
    });

    // Replace earlier seed rows (bookings and customers), leaving hand-made data alone.
    await db.$transaction([
      db.notification.deleteMany({ where: { OR: [{ id: { startsWith: "seed_" } }, { bookingId: { startsWith: "seed_" } }] } }),
      db.payment.deleteMany({ where: { bookingId: { startsWith: "seed_" } } }),
      db.paymentAttempt.deleteMany({ where: { bookingId: { startsWith: "seed_" } } }),
      db.paymentLink.deleteMany({ where: { bookingId: { startsWith: "seed_" } } }),
      db.booking.deleteMany({ where: { id: { startsWith: "seed_" } } }),
      db.customerPhone.deleteMany({ where: { customerId: { startsWith: "seed_" } } }),
      db.customerEmail.deleteMany({ where: { customerId: { startsWith: "seed_" } } }),
      db.customer.deleteMany({ where: { id: { startsWith: "seed_" } } }),
      db.expense.deleteMany({ where: { id: { startsWith: "seed_" } } }),
      db.block.deleteMany({ where: { id: { startsWith: "seed_" } } }),
      db.auditLog.deleteMany({ where: { id: { startsWith: "seed_" } } }),
    ]);

    /* Customers */
    const customers: { id: string; name: string; phone: string; email: string | null; placeholder: boolean }[] = [];
    for (let i = 1; i <= 30; i++) {
      const id = `seed_cus_${pad(i)}`;
      let name = `${FIRST[(i - 1) % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`;
      // Near-duplicates for the "possible duplicates" list (week one): same person, different spelling.
      if (i === 29) name = "Adaeze Okafo";
      if (i === 30) name = "Ada Okafor";
      const phone = fakePhone(i);
      const phoneOnly = i % 5 === 0;
      const email = phoneOnly ? placeholderEmailFor(phone, PLACEHOLDER_DOMAIN) : `${name.toLowerCase().replace(/\s+/g, ".")}.${i}@example.test`;
      const phones = [phone, ...(i % 7 === 0 ? [fakePhone(100 + i)] : [])];
      const emails = [
        { value: email, isPlaceholder: phoneOnly, bouncedAt: i === 8 ? new Date(nowMs - 3 * 86_400_000) : null },
        ...(i % 9 === 0 ? [{ value: `second.${i}@example.test`, isPlaceholder: false, bouncedAt: null }] : []),
      ];
      const consent = i % 2 === 0;
      await db.customer.create({
        data: {
          id,
          displayName: name,
          notes: i % 6 === 0 ? "Sample note: prefers a quiet chair." : "",
          tags: i % 10 === 1 ? ["VIP"] : [],
          marketingConsent: consent,
          marketingConsentAt: consent ? new Date(nowMs - i * 86_400_000) : null,
          createdAt: new Date(nowMs - (90 - i) * 86_400_000),
          phones: { create: phones.map((e164) => ({ e164 })) },
          emails: { create: emails },
          nameVariants: { create: [{ name }, ...(i === 3 ? [{ name: "Chiamaka B." }] : [])] },
        },
      });
      customers.push({ id, name, phone, email: phoneOnly ? null : email, placeholder: phoneOnly });
    }

    /* Bookings, payments and notifications */
    const services = new Map(SERVICES.map((s) => [s.id, s]));
    const mains = SERVICES.filter((s) => s.bookableAlone);
    type Plan = { status: Prisma.BookingCreateInput["status"]; dayOffset: number; balance?: "online" | "manual" | "adjust" };
    const plans: Plan[] = [];
    for (let i = 0; i < 26; i++) plans.push({ status: "completed", dayOffset: -2 - i * 2, balance: i % 3 === 0 ? "online" : i % 3 === 1 ? "manual" : undefined });
    plans[4].balance = "adjust";
    for (let i = 0; i < 4; i++) plans.push({ status: "no_show", dayOffset: -5 - i * 7 });
    for (let i = 0; i < 4; i++) plans.push({ status: "cancelled", dayOffset: -3 - i * 9 });
    plans.push({ status: "expired", dayOffset: 4 });
    for (let i = 0; i < 14; i++) plans.push({ status: "confirmed", dayOffset: i < 3 ? 0 : i < 6 ? 1 : 2 + i });
    plans.push({ status: "pending_payment", dayOffset: 3 });
    plans.push({ status: "needs_attention", dayOffset: 5 });

    const exampleLinks: string[] = [];
    let n = 0;
    for (const plan of plans) {
      n++;
      const id = `seed_bkg_${pad(n)}`;
      const customer = customers[(n * 7) % customers.length];
      const main = pick(mains);
      const addOnIds = (ADD_ONS[main.id] ?? []).filter(() => rand() < 0.4);
      const items = [
        { kind: "main" as const, serviceId: main.id, name: main.name, priceKobo: main.priceKobo, durationMinutes: main.durationMinutes },
        ...addOnIds.map((aid) => {
          const a = services.get(aid)!;
          return { kind: "add_on" as const, serviceId: a.id, name: a.name, priceKobo: a.addOnPriceKobo ?? a.priceKobo, durationMinutes: a.addOnDurationMinutes ?? a.durationMinutes };
        }),
      ];
      const totalKobo = items.reduce((s, x) => s + x.priceKobo, 0);
      const duration = items.reduce((s, x) => s + x.durationMinutes, 0);
      const deposit = depositDue({ mainServiceKobo: main.priceKobo, totalKobo }, DEPOSIT_RULE);

      const dateKey = addDays(today, plan.dayOffset);
      // Sundays are closed in the placeholder hours; move to Monday.
      const dk = new Date(`${dateKey}T00:00:00Z`).getUTCDay() === 0 ? addDays(dateKey, 1) : dateKey;
      const startMinute = 9 * 60 + 30 * Math.floor(rand() * Math.max(1, (19 * 60 - duration - 9 * 60) / 30));
      const startAt = new Date(lagosToUtcMs(dk, startMinute));
      const endAt = new Date(startAt.getTime() + duration * MIN);
      const createdAt = new Date(Math.min(startAt.getTime() - 3 * 86_400_000, nowMs - 60 * MIN));
      const token = `seedtoken${n}`;
      if (exampleLinks.length < 2 && plan.status === "confirmed") exampleLinks.push(`/booking/${`HC-SD${pad(n)}`}?t=${token}`);

      const paid = plan.status !== "pending_payment" && plan.status !== "expired";
      const payments: Prisma.PaymentCreateWithoutBookingInput[] = [];
      if (paid) payments.push({ type: "deposit", method: rand() < 0.7 ? "card" : "transfer", amountKobo: deposit, paystackReference: `seed_dep_${pad(n)}`, createdAt });
      if (plan.status === "completed" && plan.balance) {
        const balanceAt = new Date(endAt.getTime() + 30 * MIN);
        if (plan.balance === "online") payments.push({ type: "balance_online", method: "transfer", amountKobo: totalKobo - deposit, paystackReference: `seed_bal_${pad(n)}`, createdAt: balanceAt });
        if (plan.balance === "manual") payments.push({ type: "manual", method: "cash", amountKobo: totalKobo - deposit, recordedBy: { connect: { id: admin!.id } }, note: "Paid in cash at the salon.", createdAt: balanceAt });
        if (plan.balance === "adjust") {
          payments.push({ type: "manual", method: "transfer", amountKobo: totalKobo - deposit + naira(1000), recordedBy: { connect: { id: admin!.id } }, note: "Transfer to the salon account.", createdAt: balanceAt });
          payments.push({ type: "adjustment", method: "other", amountKobo: -naira(1000), recordedBy: { connect: { id: admin!.id } }, note: "Correction: manual entry was ₦1,000 too high.", createdAt: new Date(balanceAt.getTime() + 60 * MIN) });
        }
      }

      const futureConfirmed = plan.status === "confirmed" && startAt.getTime() > nowMs;
      const notifications: Prisma.NotificationCreateWithoutBookingInput[] = [];
      if (futureConfirmed || plan.status === "needs_attention") {
        const channel = customer.email ? "email" : "whatsapp_manual";
        notifications.push({ id: `seed_ntf_c${pad(n)}`, dedupeKey: `confirmation:${id}`, customerId: customer.id, type: "confirmation", channel, status: customer.email ? "sent" : "pending", dueAt: createdAt, sentAt: customer.email ? createdAt : null, attempts: customer.email ? 1 : 0 });
        if (futureConfirmed) {
          notifications.push({ id: `seed_ntf_r${pad(n)}`, dedupeKey: `reminder:${id}`, customerId: customer.id, type: "reminder", channel, status: "pending", dueAt: new Date(startAt.getTime() - 24 * 60 * MIN) });
        }
      }

      await db.booking.create({
        data: {
          id,
          reference: `HC-SD${pad(n)}`,
          accessTokenHash: await sha256Hex(token),
          accessExpiresAt: new Date(endAt.getTime() + 30 * 86_400_000),
          customer: { connect: { id: customer.id } },
          contactName: customer.name,
          contactPhone: customer.phone,
          contactEmail: customer.email,
          startAt,
          endAt,
          status: plan.status,
          holdExpiresAt: plan.status === "pending_payment" ? new Date(nowMs + 10 * MIN) : plan.status === "expired" ? new Date(nowMs - 2 * 60 * MIN) : null,
          totalKobo,
          depositDueKobo: deposit,
          customerNote: n % 8 === 0 ? "Sample note from the customer." : "",
          completedAt: plan.status === "completed" ? endAt : null,
          cancelledAt: plan.status === "cancelled" ? new Date(startAt.getTime() - 86_400_000) : null,
          createdAt,
          items: { create: items },
          payments: { create: payments },
          notifications: { create: notifications },
        },
      });
    }

    // Owner alert awaiting send, and a failed reminder for the attention box.
    await db.notification.create({
      data: { id: "seed_ntf_owner1", dedupeKey: "seed:owner_alert:1", type: "owner_alert", channel: "email", status: "pending", dueAt: new Date(nowMs), payload: { kind: "sample", message: "Sample owner alert." } },
    });

    /* Expenses across every category over the last 60 days */
    for (let i = 1; i <= 40; i++) {
      const category = categories[i % categories.length];
      await db.expense.create({
        data: {
          id: `seed_exp_${pad(i)}`,
          date: new Date(`${addDays(today, -Math.floor(rand() * 60))}T00:00:00Z`),
          amountKobo: naira(500 * (1 + Math.floor(rand() * 40))),
          categoryId: category.id,
          method: pick(["cash", "transfer", "card", "other"] as const),
          note: i % 4 === 0 ? "Sample expense note." : "",
          createdById: admin!.id,
          deletedAt: i === 40 ? new Date(nowMs - 86_400_000) : null,
        },
      });
    }

    /* A block: salon closed one afternoon next week */
    const blockDay = addDays(today, 8);
    await db.block.create({
      data: { id: "seed_blk_001", startAt: new Date(lagosToUtcMs(blockDay, 14 * 60)), endAt: new Date(lagosToUtcMs(blockDay, 19 * 60)), capacityReduction: null, reason: "Sample: staff training", createdById: admin!.id },
    });

    await db.auditLog.create({
      data: { id: "seed_aud_001", actorLabel: "System", action: "seed.run", entityType: "Database", summary: "Development seed data loaded" },
    });

    const counts = {
      customers: await db.customer.count(),
      bookings: await db.booking.count(),
      payments: await db.payment.count(),
      expenses: await db.expense.count(),
    };
    console.log("Seed complete:", counts);
    console.log(`Admin: ${adminEmail}`);
    if (printedPassword) console.log(`Admin password (shown once, set SEED_ADMIN_PASSWORD to choose your own): ${printedPassword}`);
    console.log("Sample customer booking links:", exampleLinks.join("  "));
  } finally {
    await db.$disconnect();
  }
}

// Run only when executed directly (tests import assertLocalDatabase).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
