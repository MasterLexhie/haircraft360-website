# Haircraft 360 website

Booking website and owner admin for Haircraft 360, a hair salon in Ibadan. Customers book online
without an account and pay a deposit; the owner runs bookings, customers, payments and expenses
from the admin.

**Status:** being built from the prototype towards launch. The plan and the reasons behind it are in
[`docs/FINAL_PLAN.md`](docs/FINAL_PLAN.md); the product spec is [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md).
Until Milestone 4, payments go through a development-only mock checkout and no money moves.

## Run it locally

Requires Node 22 and a local PostgreSQL (for example DBngin or Postgres.app). No Docker.

```bash
createdb haircraft360_dev
createdb haircraft360_test
cp .env.example .env.local     # then set AUTH_SECRET and CRON_SECRET to long random strings
npm install                    # also generates the Prisma client
npm run db:migrate             # applies prisma/migrations to haircraft360_dev
npm run db:seed                # fake sample data; refuses to run against a non-local database
npm run dev                    # http://localhost:3000
```

The seed prints a generated admin password once (or set `SEED_ADMIN_PASSWORD`). Until Milestone 2
replaces it, the admin still uses the temporary demo login in `src/mock/demo-config.ts`.

Set `ENABLE_MOCK_CHECKOUT="true"` in `.env.local` to confirm bookings through the mock checkout.
Never set it in a hosted environment.

## Scripts

| Script | What it does |
| - | - |
| `npm run dev` | Next.js dev server |
| `npm run lint`, `npm run typecheck` | ESLint and TypeScript |
| `npm test` | Vitest: unit tests plus database tests against `TEST_DATABASE_URL` (wiped on each run) |
| `npm run build` | Production build |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply existing migrations (CI and production) |
| `npm run db:seed` | Load fake sample data locally |
| `npm run db:studio` | Browse the local database |

CI (`.github/workflows/ci.yml`) runs lint, type check, migrations, tests and build on every push.

## Where things live

| Area | Location |
| - | - |
| Data model and migrations | `prisma/schema.prisma`, `prisma/migrations/` (row-level security on every table) |
| Database client | `src/server/db.ts` (Prisma with the `pg` driver adapter) |
| Pure rules: availability, deposit, pricing, phone numbers, settings shapes | `src/domain/` |
| Booking creation, payment recording, admin changes (all transactional) | `src/server/booking-service.ts` |
| Customer matching (phone, then email; never by name) | `src/server/customers.ts` |
| Read queries for pages | `src/server/queries.ts` |
| Money (integer kobo) and Lagos time | `src/lib/money.ts`, `src/lib/time.ts` |
| Hashing and tokens (Web Crypto) | `src/lib/crypto.ts` |
| Development-only mock checkout | `src/server/payments/mock.ts` (removed in Milestone 4) |

Key rules:
- Prices are always computed on the server from service IDs; the browser never sends amounts.
- Creating, confirming or reinstating a booking takes a per-day database lock and re-checks capacity,
  so two customers can never take the last place.
- Payments are an append-only ledger; corrections are new rows. Balance = total minus successful payments.
- Customer pages show only what was entered for that booking, never the stored customer profile.
- Booking links carry a random token; only its hash is stored.

## Stack

Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, TypeScript, Tailwind CSS 4,
Prisma 7 on PostgreSQL, Zod, libphonenumber-js, Vitest. Visual language: the "Plum Lounge" design
system in `DESIGN-SYSTEM.md`.
