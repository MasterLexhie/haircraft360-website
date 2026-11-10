# Haircraft360 — website prototype

A mobile-first **prototype** of the Haircraft360 customer website, booking flow, owner admin and a mock backend.
It demonstrates the PRD journey end to end with **demo data and simulated payments only**.

> ⚠️ Not production-ready. No real payments, no real notifications, demo-only authentication, and
> every business fact is either unverified (from a public listing) or a labelled demo value.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

- Public site: `/` · booking: `/book` · find a booking: `/booking`
- Demo admin: `/admin` → sign in with the **demo owner credentials in `src/mock/demo-config.ts`**
  (the sign-in page also has a “Fill demo credentials” button).
- Mock data persists to `.data/haircraft360-demo-db.json` (git-ignored). Delete the file, or use
  **Admin → Settings → Reset demo data**, to return to the seeded state. Seed dates are relative to “now”.
- Seeded customer lookups (Find my booking): `HC-DEMO2` + `0800 000 0002`, `HC-DEMO1` + `0800 000 0001`.

Checks: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## What’s implemented

**Customer site** (`src/app/(site)`)
- Home: hero, “how booking works”, service cards with multi-select → booking, before/after gallery
  placeholders, visit section (address, tap-to-call, listed hours, Google Maps directions link — no fake
  embed), closing CTA, sticky mobile booking bar, prototype notice.
- Booking wizard (`/book`): 4 steps — services → date & time → details → review — with step indicator,
  persistent summary (desktop) / sticky total bar (mobile), draft kept in `sessionStorage`, inline + summary
  validation, slot-taken recovery, no-slots empty state with “next available date” and call action.
- Mock checkout (`/checkout/[ref]`): clearly labelled Paystack stand-in, hold countdown, simulate
  success / failure, retry, expired-hold state. No card fields.
- Booking page (`/booking/[ref]?t=…`): confirmation, status, services, salon note, payments + history,
  pay deposit / pay balance actions, other bookings by the same customer.

**Admin** (`src/app/admin`)
- Demo sign-in + `proxy.ts` gate + server-side `requireAdmin()` on every page and action.
- Dashboard: today, next 7 days, awaiting deposit, balances due, “needs completion” prompt, recent activity.
- Bookings: search/filter by text, status, payment state, date range; booking detail with snapshot
  lines, money summary, payment entries, manual payment entry, completion form (delivered services,
  extras, actual total, customer-visible note), balance payment link, cancel / no-show / reinstate,
  private note, audit timeline.
- Customers: search, chronological bookings + payments timeline, private notes.
- Settings: demo services editor, sample hours, booking horizon, hold window, lead time, slot step,
  default duration, capacity, demo deposit rule, owner checklist, unverified-facts panel, reset demo data.

## Business rules (and where they live)

| Rule | Location |
|---|---|
| Money in integer kobo, shown as NGN | `src/lib/money.ts` |
| Africa/Lagos time (UTC+1, no DST) | `src/lib/time.ts` |
| Slots from hours + duration + blocking bookings; no overlaps | `src/domain/availability.ts` |
| Unpaid holds block a slot until `holdExpiresAt`, then release | `isBlocking`, `sweepExpiredHolds` |
| Deposit rule, estimate, `balanceDue = max(actual − Σ successful payments, 0)` | `src/domain/pricing.ts` |
| Booking snapshots service name/price/duration | `createPendingBooking` in `src/server/booking-service.ts` |
| Booking confirmed only by a successful (mock) deposit | `completeMockCheckout` |
| Repeated callbacks never add a second payment | `resolveCheckout` in `src/server/payments/mock-checkout-adapter.ts` |
| Estimated vs actual totals; private vs customer-visible notes kept separate | `src/domain/types.ts` |
| Atomic check-and-reserve | `transaction()` in `src/server/store.ts` |

## Demo-only / needs owner confirmation

Nothing below is a confirmed business decision. Tracked in **Admin → Settings → Needs owner confirmation**.

- **Business facts** (`src/config/business.ts`): name/listing title, address, phone, hours and the
  rating snapshot come from a public listing mirror (fetched 14 Sep 2026) and are flagged
  `verified: false`. The rating is **hidden** on the public site until `approvedForDisplay` is set.
- **Services, prices, durations** (`src/mock/demo-config.ts`): all four are invented “Demo service”
  values loosely based on review topics. One is unpriced to show “price confirmed at appointment”.
- **Availability**: Mon–Sat 8 am–9 pm (from the listing), 30-day horizon, 15-min unpaid hold, 2-hour
  minimum notice, 30-min start step, one chair, back-to-back services — all demo.
- **Deposit**: 30 % of the estimate, min ₦2,000 — demo. Cancellation, refund, reschedule and late-arrival
  terms are **not shown** because none are approved.
- **Booking status names**, manual payment methods, notifications, staffing/sequencing — open PRD decisions.
- **Content**: no salon description, photos or social links were supplied; placeholders are labelled.
- **Credentials**: demo admin login and the demo session secret (`DEMO_SESSION_SECRET` env override).
- Logo files are the supplied raster artwork (`public/brand`); the SVGs wrap rasters, not vector paths.

## Replace before production

| Prototype module | Production replacement |
|---|---|
| `src/server/store.ts` (JSON file + in-memory) | Real database (e.g. Postgres) with transactions and an exclusion constraint / row lock on booked time ranges; migrations; backups + tested restore |
| `src/server/auth.ts`, `src/proxy.ts`, `DEMO_ADMIN` | Proper identity provider, hashed credentials, MFA, rate limiting, session rotation, server-side authorisation on every action |
| `src/server/payments/mock-checkout-adapter.ts`, `/api/checkout/[ref]`, `/checkout/[ref]` | Paystack: server-side transaction initialise, signature-verified webhook + verify-transaction call, unique references, idempotent processing, reconciliation view. Never trust the browser redirect |
| Customer booking link (`accessToken` in URL) | Signed, expiring links; rate-limited lookup |
| (none) | Notifications (email/SMS/WhatsApp) once the owner decides |
| `audit` array | Append-only audit store with retention policy |
| Lagos UTC+1 maths in `src/lib/time.ts` | tz-aware library if more locations/timezones are added |
| Placeholders and `src/config/business.ts` | Owner-approved content, photos, policies; set `NEXT_PUBLIC_PREVIEW_MODE=false` only when all facts are verified |

## Stack

Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, TypeScript, Tailwind CSS 4,
lucide-react icons, Playfair Display + Montserrat via `next/font`. Visual language: the "Plum Lounge"
design system — plum, blush and the pink-logo lilac — documented in `DESIGN-SYSTEM.md` and rendered live at `/styleguide`.
