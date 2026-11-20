# Haircraft 360: Final Plan for Launch and After

**Status:** draft for review. No application code has been changed.
**Prepared:** 18 Nov 2026, on branch `prototype-tightening` at commit `4b1c437` (identical to `main`; none of the tightening tasks have landed).
**Sources reconciled:** `docs/BUILD_SPEC.md` (Spec), `docs/findings-and-recommendations.md` (F&R), `docs/prototype-tightening.md` (PT), `docs/production-readiness.md` (PR), and the code.
**Precedence used:** Spec for product direction, code for current state, analysis for technical risk the Spec does not cover.

This document replaces the `docs/analysis/gap-report.md` asked for in Spec Section 1.1. The gap mapping is in Section 3.

Effort key: **S** is up to half a day, **M** is about a day, **L** is two to three days. Estimates assume agent-written code with your review.


## 1. Summary

- The prototype is a clean, honest demo: the booking journey, availability maths, kobo money handling, price snapshots and admin screens all work on mock data, and `tsc` and `lint` pass.
- Almost everything that touches the real world is mocked: storage is a JSON file (`src/server/store.ts`), auth is one hard-coded login (`src/server/auth.ts`), payment is a simulated page (`src/server/payments/mock-checkout-adapter.ts`), and there are no notifications, finances, tests or CI.
- The Spec's data model differs a lot from the prototype's: add-ons, multiple phones and emails per customer, a typed payment ledger, payment links, webhook and notification tables, blocks, buffer, per-weekday capacity, expenses and new booking statuses. The domain layer (`src/domain`, `src/lib`) and the UI are reusable. The data layer, auth and payments are rewrites.
- Hosting moves from Render (`render.yaml`) to Cloudflare Workers. This is unproven with Next.js 16.4, Prisma and `proxy.ts`. By your decision the app is built host-independent first and checked on Workers once most parts are done (H0).
- One real data exposure exists today (F-01, confirmed). It disappears if the new booking page shows only the booking's own snapshot.
- **Gap to launch: roughly 50 effort days at the estimates in Section 5.** No fixed launch date; full scope kept (D1).


## 2. Verified current state

**Conclusion:** a single Next.js 16.4.6 app with good domain logic and mock infrastructure. Every analysis claim I checked is accurate for the current code, except one that is partly wrong and two that are overtaken by the Spec.

### What exists

| Area | What the code does | Files |
| - | - | - |
| Stack | Next.js 16.4.6 App Router with `cacheComponents` and `partialPrefetching`, React 19.3, Tailwind 4.3, TypeScript. Dependencies are only `next`, `react`, `lucide-react` and `server-only`. No Prisma, Zod, Paystack, Resend or test runner. | `package.json`, `next.config.ts` |
| Public routes | Home (one long page with services, about, gallery, visit and CTA sections), `/book`, `/booking` (Find my booking), `/booking/[reference]?t=`, `/checkout/[reference]` (mock), `/styleguide` (public). | `src/app/(site)/*` |
| API routes | `GET /api/availability`, `POST /api/bookings`, `POST /api/bookings/[reference]/checkout`, `POST /api/checkout/[reference]` (mock pay). | `src/app/api/*` |
| Data | JSON file plus in-memory copy; `transaction()` is synchronous and only atomic in one Node process. Data is wiped on every Render restart. | `src/server/store.ts`, `src/mock/seed.ts`, `src/mock/demo-config.ts` |
| Data model | Service (no add-ons; price and duration may be null), Customer (one phone, one email), Booking with `lines` snapshot, estimated and actual totals, statuses `awaiting_deposit, confirmed, completed, cancelled, no_show, expired`. Payment with purpose `deposit, balance, manual`. Audit events. Settings with one `concurrentCapacity`, no buffer, no blocks. | `src/domain/types.ts` |
| Booking flow | 4 steps: pick one or more services (checkboxes, no main and add-on split), date and time, contact (phone **or** email), review. Then redirect to the mock checkout page. | `src/components/booking/booking-wizard.tsx`, `date-time-step.tsx` |
| Availability | Opening hours, slot step, lead time, horizon, capacity, live holds; expired holds ignored. Duration is the sum of services. **No buffer, no per-weekday capacity, no blocks.** | `src/domain/availability.ts` |
| Pricing | Integer kobo; deposit percent or fixed with a minimum; balance from successful payments; overpayment detection. Server computes price from service IDs. | `src/domain/pricing.ts`, `src/lib/money.ts`, `src/server/booking-service.ts:103` |
| Phones | Normalised to local `0803...` format by regex, not E.164. | `src/domain/validation.ts:11` |
| Customer matching | Phone or email match, keeps stored name, fills a missing contact. | `src/server/booking-service.ts:63` |
| Auth | One demo account; HMAC-signed cookie (httpOnly, sameSite lax, secure in production); `requireAdmin()` on every admin page and all 10 data-changing actions; optimistic redirect in `proxy.ts`. No rate limit, no hashing. | `src/server/auth.ts`, `src/proxy.ts`, `src/app/admin/actions.ts` |
| Admin | Dashboard, Bookings list and detail, Customers list and detail, Settings (Services; Availability and deposit; Needs owner confirmation), Reset demo data. | `src/app/admin/(panel)/*`, `src/components/admin/*` |
| SEO | Whole site `noindex` in the root layout; no sitemap, robots, structured data or OG image. | `src/app/layout.tsx` |
| Hosting | Render free blueprint. | `render.yaml` |
| Quality | Type-check (`tsc`) clean and `npm run lint` clean (re-run today). No tests, no CI, no `.env.example`, no `error.tsx` or `not-found.tsx`. Scaffold SVGs still in `public/`. | |
| Time | Fixed UTC+1 offset for Lagos, which is correct (no daylight saving). | `src/lib/time.ts` |

### Analysis claims checked

| Claim | Verdict | Evidence |
| - | - | - |
| F-01 booking with someone else's phone exposes their bookings with working token links | Confirmed | `booking-service.ts:63-76`, `queries.ts:66-69`, `booking/[reference]/page.tsx:194-208` |
| F-02 checkout page hands out the access token | Confirmed | `queries.ts:79-85` |
| F-03 anyone with a checkout reference can mark it paid | Confirmed | `api/checkout/[reference]/route.ts` |
| F-04 reinstating ignores live holds and capacity | Confirmed | `booking-service.ts:343-348` |
| F-05 manual payments have no status guard | Confirmed | `booking-service.ts:382-412` |
| F-06 abandoned state lost on throw | Confirmed | `booking-service.ts:191-195`, `store.ts:56-62` |
| F-07 persist failures swallowed | Confirmed | `store.ts:47-49` |
| F-08 no rate limiting | Confirmed | No limiter anywhere in `src` |
| F-09 holds uncapped | Confirmed | `createPendingBooking` |
| F-10 credentials committed, secret fallback | Confirmed, and worse than stated: `login-form.tsx` is a client component that imports `DEMO_ADMIN`, so the password ships in the browser bundle | `src/mock/demo-config.ts:113`, `src/server/auth.ts:9`, `src/app/admin/login/login-form.tsx:1,8` |
| F-11 to F-17 (headers, token in URL, tests, CI, error pages, `.env.example`, scaffold files) | Confirmed | `next.config.ts`, file listing |
| "Customer queries strip `privateNote` and `accessToken`" | Partly incorrect | `toPublicBooking` strips them, but `getCheckout` returns `accessToken` and `history` returns other bookings' tokens |
| "All 10 data-changing actions call `requireAdmin()`" | Confirmed; every admin page also calls it | `actions.ts`, `admin/(panel)/*/page.tsx` |
| "Build succeeds, 18 routes" | Not re-checked | Build not run in this task |
| PR Phase 1: "shapes in `types.ts` map across directly" | Outdated against the Spec | The Spec model needs add-ons, multi-contact customers, a typed ledger and several new tables |
| PR Phase 6: "always-on paid instance, no sleeping" | Outdated | Written for Render. Workers do not sleep like Render's free plan. |


## 3. Reconciliation table

**Conclusion:** 89 rows after merging duplicates. Most analysis findings agree with the Spec or fold into it. Twelve analysis recommendations are dropped because they contradict the Spec or are deleted by the rewrite. Fourteen valid risks are added from the analysis. Six items need your decision (Section 4).

Sources: **Spec**, **F&R**, **PT**, **PR**. Phases: **Launch**, **Wk1-2** (first two weeks), **Later**.

### Data model and platform

| # | Item | Source | Status | Phase | Reason |
| - | - | - | - | - | - |
| 1 | Postgres on Supabase through Prisma, server only | Spec, PR P1, F&R F-19 | Agreed | Launch | Replaces JSON store; Spec fixes the engine |
| 2 | Full Spec Section 5 schema (Customer, CustomerPhone, CustomerEmail, NameVariant, Service with add-on join, Booking, BookingItem, Payment ledger, PaymentLink, WebhookEvent, Notification, Settings, Block, Expense, ExpenseCategory, AdminUser, AuditLog) | Spec | Spec only | Launch | Live data cannot be restructured later |
| 3 | Price and duration snapshot per booking item | Spec, F&R | Already done (in shape) | Launch | `snapshotLine` in `booking-service.ts:78`; carry into BookingItem |
| 4 | Money as integer kobo | Spec, F&R | Already done | Launch | `src/lib/money.ts`, `src/domain/pricing.ts` |
| 5 | Africa/Lagos time handling | Spec | Already done | Launch | `src/lib/time.ts`; fixed offset is correct |
| 6 | Booking statuses renamed and extended (`pending_payment`, `needs_attention`) | Spec | Spec only | Launch | Code uses `awaiting_deposit`, no `needs_attention` |
| 7 | Async data layer; keep `src/domain` pure | PR P1, F&R | Agreed | Launch | Prisma is async; domain stays I/O free |
| 8 | Remove `isDemo`, mock seed from runtime, Reset demo data | PR P1, PR P6 | Agreed | Launch | Prototype surface |
| 9 | Seed script, fake data, refuses non-local host | Spec 12 | Spec only | Launch | Safe local development |
| 10 | Exclusion constraint or chairs as rows to stop overlaps | PR P1 | Dropped | | Spec decides advisory lock plus re-check (item 22); capacity is a count, not chairs |
| 11 | Scheduled job to expire holds | PR P1 | Dropped | | Spec: expired holds are ignored, no cleanup job |
| 12 | Backups and one tested restore | PR P1 | Added from analysis | Launch | Data integrity; Supabase free plan backups are limited (see D5) |
| 13 | Audit log of admin actions with real actor | Spec, PR P2 | Agreed | Launch | Exists as `audit` with a fixed actor string |
| 14 | Audit retention period | PR P1 | Added from analysis | Later | Not needed at launch volume |
| 15 | Notification uniqueness must allow reschedules and the daily summary | Analysis of Spec (new) | Added from analysis | Launch | "Unique on booking plus type" blocks a fresh reminder after a reschedule and does not dedupe the bookingless daily summary. Use a `dedupeKey` and reset the row on reschedule |
| 16 | Email that already belongs to another customer | New, from Spec matching rule | Added from analysis | Launch | Phone matches A, email matches B: attaching the email to A breaks the unique index. Keep it off A and surface as a possible duplicate |

### Security

| # | Item | Source | Status | Phase | Reason |
| - | - | - | - | - | - |
| 17 | Stop cross-customer exposure on the booking page | F&R F-01, PT T-01 | Agreed | Launch | Spec: never reveal another customer's details. Show only the booking's snapshot name and no history |
| 18 | Verify phone or email by one-time code before showing history or merging | PR P5 | Dropped | | Spec: no customer logins, match by phone automatically. Item 17 closes the leak without it |
| 19 | Admin auth: AdminUser, hashed passwords, rate-limited login, secure cookies, checks in every handler | Spec 6.8, PR P2, F&R F-10, F-20 | Agreed | Launch | Replace demo login; remove committed and bundled password |
| 20 | 2FA for the owner | Spec, PR P2 | Agreed | Launch | Decided 18 Nov: required at launch, with backup codes (S7) |
| 21 | Password reset | PR P2 | Added from analysis | Launch (script only) | Owner must not be locked out; a developer-run reset script is enough at launch, a self-service flow later |
| 22 | Use a maintained auth library or hosted identity provider | PR P2 | Dropped | | Decided D3: small in-house login with the layered protections in Section 4 |
| 23 | Rate limits on login, booking creation, payment init, Find my booking | Spec, F&R F-08, PT T-06 | Agreed | Launch | In-memory limiter (PT) does not work across Worker isolates; use a Postgres-backed limiter |
| 24 | Cap active holds per phone | Spec, F&R F-09, PT T-07 | Agreed | Launch | Same rule in both |
| 25 | Honeypot field, no CAPTCHA | Spec | Spec only | Launch | |
| 26 | Server validation of every input (Zod) | Spec | Spec only | Launch | Current validation is hand-written and partial |
| 27 | Security headers including CSP | Spec, F&R F-11, PT T-09, PR P6 | Agreed | Launch | CSP must allow the Paystack inline script and frame |
| 28 | RLS on with no policies, or Data API off | Spec | Spec only | Launch | Supabase setting plus a migration |
| 29 | Secrets in env only, `.env.example`, secret scanning, Dependabot | Spec, F&R F-16 | Agreed | Launch | `.env*` is already ignored in `.gitignore` |
| 30 | Error pages, no stack traces, no public source maps | Spec, F&R F-15, PT T-12 | Agreed | Launch | |
| 31 | Token on mock checkout (F-02, F-03), state lost on throw (F-06), log persist failures (F-07) | F&R, PT T-02, T-05, T-13 | Dropped | | Code is deleted in the rewrite. Lesson kept: never mutate then throw inside a transaction |
| 32 | Reinstating a booking must use the real capacity check | F&R F-04, PT T-03 | Added from analysis | Launch | Applies equally to the new admin "move booking" action |
| 33 | Guard manual payments by booking status | F&R F-05, PT T-04 | Added from analysis | Launch | Allow on confirmed, completed, needs attention; block on expired and cancelled |
| 34 | Do the PT tightening pass on the mock store before building production | PT, F&R rec. 2 | Conflict | | See D2 |
| 35 | Privacy policy listing processors and marketing consent | Spec, PR P5 | Agreed | Launch | Content to be checked by you; not legal advice |
| 36 | Booking terms, including "deposit is non-refundable", shown before paying | PR P5, PR P0 | Added from analysis | Launch | Spec says deposits are never refunded; customers must be told before they pay, or disputes follow |
| 37 | NDPA 2023 obligations, data-request contact, retention, deletion | PR P5 | Added from analysis | Later | Deletion conflicts with the append-only ledger; needs advice (open question) |

### Bookings and availability

| # | Item | Source | Status | Phase | Reason |
| - | - | - | - | - | - |
| 38 | Main service then optional add-ons with Skip, live total | Spec 6.1 | Spec only | Launch | Code has a flat multi-select |
| 39 | Times calculated from total duration including add-ons | Spec | Already done (logic) | Launch | `estimateServices` sums durations; must include add-on durations |
| 40 | Phone required; email required unless the customer ticks "I don't have an email"; marketing consent | Spec, refined 18 Nov 2026 | Spec only | Launch | Code accepts phone **or** email (`validation.ts:30`). Ticking the checkbox books with phone only |
| 41 | Phones in E.164 via `libphonenumber-js` | Spec | Spec only | Launch | Code stores `0803...` |
| 42 | Buffer, per-weekday capacity, Blocks | Spec 6.2 | Spec only | Launch | Not in `availability.ts` |
| 43 | Capacity count with live holds | Spec, F&R | Already done | Launch | `availability.ts:30-46` |
| 44 | Advisory lock per date, re-check, honest "just taken" message | Spec 6.2, PR G2 | Agreed | Launch | Replaces single-process `transaction()` |
| 45 | Late payment after hold: confirm if free else `needs_attention`, reschedule not refund | Spec | Spec only | Launch | |
| 46 | Late payment: refund if slot gone | PR P3 | Dropped | | Spec: the salon does not refund deposits |
| 47 | Customer matching: phone, then email, name variants, never by name | Spec 6.5 | Spec only | Launch | Partly present in `findOrCreateCustomer` |
| 48 | Unpriced services ("confirmed at appointment") | Code | Conflict | | See D4 |
| 49 | Lead time, horizon, customer note | Code | Already done | Launch | Not in Spec, harmless; keep as settings |
| 50 | Find my booking page | Code, F&R, PR P5 | Conflict | | See D6 |
| 51 | Customer self-reschedule and cancel | Spec 8, PR, F&R F-22 | Agreed | Later | |
| 52 | Multiple stylists with calendars | PR | Dropped | | Spec: customers do not pick a stylist |

### Payments

| # | Item | Source | Status | Phase | Reason |
| - | - | - | - | - | - |
| 53 | Paystack initialise on server, amount from service IDs, our reference, metadata | Spec 6.3, PR P3 | Agreed | Launch | Server pricing already done |
| 54 | Inline popup, browser callback only polls | Spec | Spec only | Launch | PR describes a redirect; Spec chose inline popup |
| 55 | Webhook: signature, store event, verify, amount and currency check, idempotent insert, confirm in one transaction | Spec, PR P3, F&R F-18 | Agreed | Launch | |
| 56 | Placeholder email for customers without email | Spec | Spec only | Launch | Generated on the backend from the phone when the checkbox is ticked; used only for Paystack, never emailed |
| 57 | PaymentLink tokens, fresh transaction per Pay press | Spec | Spec only | Launch | Code reuses an open checkout (`booking-service.ts:250`), which Spec forbids |
| 58 | Manual payments, typed ledger, adjustments | Spec | Agreed | Launch | Exists in simpler form |
| 59 | Wrong-amount bank transfer test | Spec 6.3, 10 | Spec only | Launch | Unknown Paystack behaviour |
| 60 | Delete mock checkout routes and component | PR P3 | Agreed | Launch | |
| 61 | Refunds process | PR P3 | Dropped | | Spec: no refunds. A genuine duplicate charge is handled as an `adjustment` row plus a manual Paystack refund (see risks) |
| 62 | Reconciliation view of gateway vs bookings | PR P3 | Added from analysis | Wk1-2 | At launch, failed WebhookEvents surface in the attention box |

### Notifications

| # | Item | Source | Status | Phase | Reason |
| - | - | - | - | - | - |
| 63 | Notification rows in the confirming transaction, cron sender with retries, idempotency key, skip rules, heartbeat | Spec 6.4, PR P4 | Agreed | Launch | |
| 64 | Confirmation and 24h reminder email with `.ics` and Google button | Spec | Spec only | Launch | |
| 65 | Owner daily summary (not per-booking alerts) | Spec | Spec only | Launch | |
| 66 | Per-booking owner email, cancellation and balance emails | PR P4 | Dropped | | Spec chose one daily summary to stay within Resend's 100 a day |
| 67 | SMS or WhatsApp API | PR P4 | Dropped for launch | Later | Spec 3: paid, later add-on |
| 68 | WhatsApp `wa.me` buttons and Reminders due list | Spec | Spec only | Launch | |
| 69 | SPF, DKIM, DMARC | PR P4 | Agreed | Launch | Resend domain verification covers SPF and DKIM; add a DMARC record |
| 70 | Resend delivery and bounce webhooks | Spec 7 | Spec only | Wk1-2 | |

### CRM, finances, admin

| # | Item | Source | Status | Phase | Reason |
| - | - | - | - | - | - |
| 71 | Customer profile stats, tags, consent, New or Returning badge | Spec 6.5 | Spec only | Launch | Customer pages exist but show only contact, notes and history |
| 72 | Duplicates list and Merge; CRM lists; CSV import | Spec 7 | Spec only | Wk1-2 | |
| 73 | Expenses, Finances page with daily `generate_series` table | Spec 6.6 | Spec only | Launch | Nothing exists |
| 74 | Dashboard, attention box, Contact your developer, Settings additions | Spec 6.7 | Spec only | Launch | See Section 7 |
| 75 | Error tracking service, uptime checks, `/api/health`, alerts to a person | PR P6, F&R F-25 | Dropped | | Spec 3: no third-party tracker; errors live on records; heartbeat alert in admin; cron-job.org failure emails act as the uptime alarm |

### SEO, hosting, quality

| # | Item | Source | Status | Phase | Reason |
| - | - | - | - | - | - |
| 76 | Titles, OG, sitemap, `HairSalon` JSON-LD, noindex on private pages (meta and header), Search Console | Spec 6.9, PR P7 | Agreed | Launch | |
| 77 | `robots.txt` disallowing `/admin`, `/booking/` | PR P7 | Dropped | | Spec: never list private paths in robots |
| 78 | Static or regenerated public pages | Spec, PR P6 | Agreed | Launch | Pages currently use `connection()`, so all are dynamic |
| 79 | Service pages, about, FAQ, gallery, facts page, `llms.txt`, AI crawler rules, Google Business Profile, reviews prompt | PR P7, P8 | Added from analysis | Later (GBP: owner, any time) | Beyond Spec launch scope. Exception: see item 85 |
| 80 | Remove prototype labels, preview mode, `/styleguide`, scaffold SVGs, rating snapshot | PR P6, F&R F-17 | Agreed | Launch | |
| 81 | Owner-approved content and real photos | PR G6, F&R F-23, Spec 9 | Agreed | Launch | Client input, not code |
| 82 | Cloudflare Workers via OpenNext; Netlify fallback | Spec 3 | Spec only | Launch | Render and "always-on paid instance" (PR P6) dropped |
| 83 | Separate test and live environments | Spec, PR P6 | Conflict (small) | | See D5 |
| 84 | Tests with each feature; CI on push | Spec 1.3, F&R F-13, F-14, PT T-10, T-11 | Agreed | Launch | Vitest plus a Postgres service in GitHub Actions |
| 85 | Cloudflare bot protection must not block search and AI search crawlers | PR P8 | Added from analysis | Launch | Cloudflare may block AI crawlers by default on new zones; check once at setup |
| 86 | Playwright end-to-end tests | PR P6 | Added from analysis | Later | Manual checklist covers launch |
| 87 | WCAG 2.2 AA pass, Core Web Vitals on a mid-range Android | PR P6 | Added from analysis | Wk1-2 (quick keyboard and phone pass at launch) | Not security or payments |
| 88 | Analytics and consent banner | PR P5 | Dropped | | No analytics in Spec |
| 89 | Business facts (address, phone, socials) live in `src/config/business.ts` | Code vs Spec 1.4 | Conflict (small) | | See D4 |


## 4. Decisions

**Conclusion:** D1, D2, D3, D4 and D6 are decided (18 Nov 2026). D5 is parked for a later discussion. Hosting checks move to the end (H0).

### Decided

| # | Decision | Effect on the plan |
| - | - | - |
| D1 | No fixed launch date; full launch scope kept | No scope cut. Section 5 order stands |
| D2 | Skip the prototype tightening pass | Its lessons go into the new code: F-01 fix (B3), capacity check on reinstate (B6), manual payment guard (P5), rate limits (S3), headers and error pages (S5), tests and CI (D3, D4) |
| D3 | Small in-house admin login, no auth library | Built in S1, S2, S7, S8 with the protections listed below |
| D4 | Accept all three recommendations | (a) Every service has a price; null prices removed, a "from" price if the client needs one. (b) Deposit minimum kept as an optional setting, off by default. (c) Salon details move into Settings (A4) |
| D6 | Keep Find my booking with rate limits | Shows only date, time, status and balance, never contact details. Rate limited in S3 |
| Hosting | Build independent of Cloudflare; check Workers once most parts are done | H0 moves to the Hosting section. New code follows the portability rules below so a later switch stays cheap |

**Portability rules while hosting is undecided** (cheap now, expensive to retrofit):
- Connect Prisma through the `pg` driver adapter from the start; it runs on Node and on Workers.
- Use Web Crypto (`crypto.subtle`) for hashing, HMAC and random tokens instead of `node:crypto`; it works in both places.
- No `node:fs` or other Node-only modules in request code; no in-memory state that must survive between requests.
- Keep `proxy.ts` to a cookie presence check; real checks stay in `requireAdmin()`.
- Webhook signature check reads the raw body with the standard `Request` API.

**Admin login and payment protections** (decided 18 Nov 2026):
- 2FA with an authenticator app is required at launch. Ten one-time backup codes are shown once at setup; the reset script (S2) can also clear 2FA if the owner loses their phone.
- Login attempts limited per IP (5 per 15 minutes) and per account. No hard lockout, so nobody can lock the owner out on purpose; instead the wait between attempts grows after repeated failures.
- The owner gets an email on a new login and on repeated failures, at most one alert per hour so Resend's daily limit is safe.
- Passwords: at least 12 characters, PBKDF2 through Web Crypto with a high iteration count. Same error message for a wrong email or a wrong password. No email-based password reset; reset is a developer script.
- Sessions stored in the database: httpOnly, Secure, SameSite cookies holding a random session ID, a few hours' expiry, a new ID on each login, and logout or a password change ends every session.
- Paystack webhooks: signature, then Verify Transaction, then amount and currency, then idempotent insert. Requests from outside Paystack's published IPs are logged as a warning, not blocked.
- No Cloudflare rate-limit rule on the login for now, because the host is not decided. Revisit after H0.
- Account protections outside the code (2FA everywhere, Paystack transfer OTP on) are in the dashboard steps in Section 8.

### Still open

**D5. Staging and backups.** Parked at your request. Needed before H1 and H7. Options to discuss then:
- Staging: (A) local is the test environment and production runs on Paystack test keys until go-live; (B) a second free Supabase project plus a preview deployment. Leaning B.
- Backups: (A) a weekly manual `pg_dump`, stored encrypted off-site, plus one tested restore before go-live; (B) a scheduled automated dump. Leaning A at launch. Customer data stays out of GitHub.

## 5. Launch task list

**Conclusion:** 53 tasks in the requested order. Everything up to SEO is built and tested locally on Node, following the portability rules in Section 4. The Workers check (H0) runs once most parts are done. Every task ends with `lint`, `tsc`, tests and build passing.

### Data model and migrations
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| D1 | Add Prisma, local Postgres, full Section 5 schema, first migration, RLS-on migration for every table | `prisma/schema.prisma`, `prisma/migrations/*`, `src/server/db.ts`, `.env.example` | `prisma migrate dev` clean; unique indexes on phone, email, Paystack reference, payment link token, notification dedupe key | L |
| D2 | Seed script with fake data covering every status and payment type; refuses non-local hosts; rerunnable | `prisma/seed.ts`, `package.json` | Runs twice without duplicates; refuses a non-localhost URL | M |
| D3 | Test harness: Vitest, test database, factory helpers | `vitest.config.ts`, `test/*` | `npm test` runs against a disposable DB | M |
| D4 | CI workflow: install, lint, type-check, test (Postgres service), build | `.github/workflows/ci.yml` | Green on a push | S |
| D5 | Replace `store.ts` with Prisma repositories; make services and queries async; remove `src/mock/*` from runtime | `src/server/*`, `src/mock/*` | Existing pages render from Postgres seed data | L |

### Security essentials
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| S1 | Admin auth per D3: PBKDF2 password hashes (12 character minimum), database sessions, logout, remove demo credentials and the fill button, audit actor from session | `prisma/schema.prisma` (AdminSession), `src/server/auth.ts`, `src/proxy.ts`, `src/app/admin/login/*`, `actions.ts` | No password string in the client bundle; wrong email and wrong password give the same message; logout and password change end all sessions; cookie flags correct | M |
| S2 | Admin user script: create user, reset password, clear 2FA | `scripts/admin-user.ts` | Developer can reset the owner's password and 2FA locally and in production | S |
| S3 | Postgres-backed rate limiter; apply to login (per IP and per account with growing waits, no hard lockout), booking create, payment init, Find my booking | `src/server/rate-limit.ts`, routes | Sixth login in 15 minutes returns a friendly block; correct password still works after the wait | M |
| S4 | Zod schemas for every route handler and server action | `src/domain/schemas.ts`, routes, `actions.ts` | Malformed bodies return 400 with no stack trace | M |
| S5 | Security headers and CSP (Paystack allowed), `X-Robots-Tag` on private routes, error and not-found pages | `next.config.ts`, `src/app/error.tsx`, `not-found.tsx`, `global-error.tsx` | Headers present; Paystack popup still opens; errors show friendly page | S |
| S7 | 2FA with an authenticator app, required for every admin; setup screen with QR code; ten backup codes | `src/server/totp.ts`, `src/app/admin/login/*`, `src/app/admin/(panel)/account/*` | Login needs password and code; a backup code works once only | M |
| S8 | Owner security emails: new login, repeated failures, capped at one per hour | `src/server/auth.ts`, `src/server/email/*` | Hammering the login sends one alert per hour at most. Sends through the N1 email adapter; until N1 lands, alerts are queued as Notification rows | S |
| S6 | Repo hygiene: `.env.example` with every Spec variable, secret scanning and Dependabot on | `.env.example`, `.github/dependabot.yml` | GitHub settings show both enabled | S |

### Bookings and availability
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| B1 | Availability engine: buffer, per-weekday capacity, Blocks, holds, total duration with add-ons | `src/domain/availability.ts`, tests | Spec example (capacity 2, 30 minute buffer, frees at 9:30) passes as a test | M |
| B2 | Phone and email normalisation with `libphonenumber-js`; phone required | `src/domain/validation.ts`, tests | 0803, 234803, +234803 all become `+234803...` | S |
| B3 | Customer matching per 6.5, name variants, email conflict rule (item 16), never reveal | `src/server/customers.ts`, tests | Booking with a seeded phone shows only the typed name and no other bookings | M |
| B4 | Create booking: advisory lock per date, re-check, BookingItems snapshot, hold cap per phone, honeypot | `src/server/booking-service.ts`, `api/bookings/route.ts`, tests | Two concurrent requests for the last slot: exactly one 201 | L |
| B5 | Booking wizard: main service, add-ons with Skip, date and time, details with consent, summary with deposit, terms notice | `src/components/booking/*`, `src/app/(site)/book/page.tsx` | Full flow on a phone viewport; Skip works; totals match server | L |
| B6 | Admin move and reinstate using the same locked check; resolves `needs_attention` | `booking-service.ts`, booking detail | Reinstating over a live hold at capacity is refused | M |
| B7 | Services and add-ons admin (flags, add-on price and duration, join table) and Blocks admin | `src/components/admin/settings-forms.tsx`, `settings/page.tsx` | Owner can add an add-on to a service and it appears in the wizard | M |

### Payments
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| P1 | Paystack server client: initialise and verify; placeholder email | `src/server/payments/paystack.ts`, tests with mocked HTTP | Amount and reference built only on the server | S |
| P2 | Deposit inline popup, "confirming your payment" state, status polling endpoint | `src/components/booking/*`, `api/bookings/[reference]/status/route.ts` | Test card payment shows confirmed after webhook, not after callback | M |
| P3 | Webhook route: signature over raw body, WebhookEvent, verify call, amount and currency check, one transaction (Payment, confirm or `needs_attention`, Notification rows) | `src/app/api/webhooks/paystack/route.ts`, tests | Duplicate, out-of-order and tampered events behave per 6.11 | L |
| P4 | PaymentLink tokens and the balance page; fresh transaction per press | `src/app/(site)/pay/[token]/page.tsx`, `src/server/payment-links.ts` | Link opened on two days both work; no transaction reused | M |
| P5 | Manual payments and adjustments; status guard | `booking-service.ts`, `booking-forms.tsx` | Cannot record against expired or cancelled; ledger rows never edited | S |
| P6 | Wrong-amount transfer test in Paystack test mode; implement the observed outcome | P3 files | Written result in this doc; handled path tested (done 20 Nov 2026: see Open questions) | M |
| P7 | Delete mock checkout route, page, component and adapter | `src/app/api/checkout/*`, `src/app/(site)/checkout/*`, `mock-checkout.tsx`, `mock-checkout-adapter.ts` | No route references "mock" | S |

### Notifications
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| N1 | Email adapter by `EMAIL_TRANSPORT` (console, mailpit, resend) and templates | `src/server/email/*` | Confirmation renders in Mailpit | M |
| N2 | Cron route: secret header, heartbeat, small batch, idempotency key, retries with backoff, daily-limit stop, skip rules, `npm run cron` | `src/app/api/cron/notifications/route.ts`, `scripts/cron.ts` | Running twice sends nothing twice; returns `ok sent=N` in under a few seconds | L |
| N3 | Reschedule resets the reminder row; daily summary dedupe | `src/server/notifications.ts` | Moved booking gets one reminder at the new time | S |
| N4 | `.ics` route and Google Calendar URL; buttons on confirmation page and in email | `src/app/api/bookings/[token]/ics/route.ts`, booking page | Fixed UID; times in UTC; opens on iPhone and Android | M |
| N5 | WhatsApp helpers, editable templates, Reminders due list, mark as sent | `src/lib/whatsapp.ts`, admin page | Tapping marks the reminder sent; it disappears from the list | M |

### CRM
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| C1 | Customer profile stats, phones and emails, tags, consent; New or Returning badge on bookings | `customers/[id]/page.tsx`, `bookings/page.tsx`, queries | Seeded returning customer shows "Returning, Nth visit" | M |

### Finances
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| F1 | Add expense form (phone friendly), list with category filter, edit, soft delete, audit | `src/app/admin/(panel)/finances/expenses/*` | Soft-deleted expense leaves totals and stays in audit | M |
| F2 | Finances page: period picker, three cards, daily table via `generate_series` in Lagos time, day drill-down | `src/app/admin/(panel)/finances/page.tsx`, `src/server/finances.ts` | Empty days show zero; totals equal the ledger sum | M |

### Admin
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| A1 | Dashboard per 6.7 | `src/app/admin/(panel)/page.tsx` | Month figures compare to last month | M |
| A2 | Needs your attention box and Contact your developer | `src/components/admin/attention.tsx` | Each row of the 6.7 table reproducible from seed; heartbeat older than 2 hours shows | M |
| A3 | Booking detail: message status labels, WhatsApp buttons, add items on the day, complete and no-show | `bookings/[id]/page.tsx`, `booking-forms.tsx` | Adding an item raises total and balance | M |
| A4 | Settings: buffer, capacity per weekday, holds, deposit rule scope, templates, expense categories, salon details (D4c) | `settings/page.tsx`, `settings-forms.tsx` | Changes apply to the next booking only | M |
| A5 | Remove prototype surface per Section 7 | many | No "demo" or "prototype" text in production build | S |

### SEO
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| E1 | Metadata, `metadataBase`, OG image, index public pages, noindex private ones | `src/app/layout.tsx`, page metadata | Public pages indexable; private pages carry meta and header noindex | S |
| E2 | `sitemap.ts`, `robots.ts` with no private paths, `HairSalon` JSON-LD from Settings | `src/app/sitemap.ts`, `robots.ts`, home page | Rich Results Test passes | S |
| E3 | Static or cached public pages, revalidated on admin save | home, `/book`, services data | Home serves without hitting the DB on every request | M |
| E4 | Privacy policy and booking terms pages, linked from footer and booking summary | `src/app/(site)/privacy`, `terms` | Linked before payment | S |

### Hosting
| ID | Task | Files | Acceptance check | Effort |
| - | - | - | - | - |
| H0 | Workers check: OpenNext Cloudflare build of the finished app; Prisma query to Postgres on Workers; measure compressed bundle and CPU per request; check `proxy.ts` and `cacheComponents` support | `wrangler.jsonc`, `open-next.config.ts` | Preview Worker serves `/`, a booking and a DB read; size under the free limit; written go or Netlify recommendation | M |
| H1 | Supabase (production and staging per D5): connection strings, `migrate deploy`, RLS check, Data API off | env only | `select` through the public API returns nothing | S |
| H2 | Cloudflare: domain, Worker deploy, secrets, bot settings allow search and AI search crawlers | `wrangler.jsonc` | Site on the custom domain over HTTPS | M |
| H3 | Resend domain, DMARC, API key, test email | env only | Test email lands in inbox, not spam | S |
| H4 | Paystack test webhook, then live keys and live webhook | env only | Test card and test transfer confirm via webhook | S |
| H5 | cron-job.org hourly job with failure alerts | dashboard | Heartbeat updates in admin | S |
| H6 | Search Console, sitemap submitted | dashboard | Sitemap read with no errors | S |
| H7 | Backup routine per D5 and one tested restore | `docs/runbook.md` | Restore into local DB matches row counts | S |
| H8 | Remove `render.yaml` and Render service | `render.yaml` | Render prototype offline | S |

### Pre-launch test checklist
Spec 6.11 in full, plus:
- [ ] F-01 regression: booking with a seeded customer's phone reveals no name, email, other references or tokens.
- [ ] Reinstate and move refuse to exceed capacity.
- [ ] Rate limits trigger on login, booking, payment init and Find my booking.
- [ ] Hold cap per phone works.
- [ ] CSP does not break the Paystack popup on iPhone Safari and Android Chrome.
- [ ] Admin password not present in any client bundle.
- [ ] Admin login requires a 2FA code; backup codes work once; logout and password change end all sessions.
- [ ] A forged webhook (bad signature) is rejected; one from an unknown IP is logged.
- [ ] Backup restored once.
- [ ] Keyboard-only pass on the wizard and payment step; phone-width layout check.
- [ ] A search crawler and an AI search crawler can fetch `/` through Cloudflare.


## 6. Post-launch phases

**Conclusion:** week one picks up the Spec's Section 7 list plus cheap follow-ups from the analysis; everything else waits.

**First two weeks**
- Possible duplicates list and transactional Merge, with tests.
- CRM lists with WhatsApp buttons: due back, lapsed, top spenders, new this month, no-show prone.
- Optional CSV import of existing customers.
- Finance extras: category bars, revenue by type, CSV exports.
- Resend webhooks for delivered, bounced, complained.
- Payment reconciliation view.
- Accessibility (WCAG 2.2 AA) and mobile performance pass.

**Later**
- WhatsApp Business API or SMS reminders (paid).
- Two-way Google Calendar sync.
- Paid monitoring and maintenance.
- Receipt photos, recurring expenses, budgets.
- Customer self-reschedule; birthday field.
- Always-on paid database.
- Self-service password reset.
- Service pages, FAQ, about, gallery, facts page, `llms.txt`, explicit AI crawler policy, review prompt (PR Phases 7 and 8).
- Playwright end-to-end tests.
- Data deletion process and audit retention, after NDPA advice.


## 7. Admin trim

**Conclusion:** keep the shell, bookings and customers; simplify the dashboard and settings; remove everything that only exists because this is a demo.

| Page or feature | Verdict | Reason |
| - | - | - |
| Admin shell, sidebar, nav (`admin-sidebar.tsx`, `admin-nav.tsx`) | Keep | Works; add Finances and Reminders due |
| Login page | Simplify | Remove demo hint text and "Fill demo credentials" |
| Dashboard "Money received" tiles | Simplify | Replace with revenue, expenses, net vs last month |
| Dashboard "Today's schedule" and "Coming up" | Keep | Match Spec 6.7 |
| Dashboard "Balances to collect" | Keep | Matches "outstanding balances" |
| Dashboard "Recent activity" feed | Remove | Replaced by Needs your attention; owner needs actions, not a log |
| Dashboard "demo records" caption | Remove | Prototype text |
| Bookings list with filters and pagination | Keep | Add New or Returning badge, new statuses |
| Booking detail: services snapshot, money panel, details | Keep | Core |
| Booking detail: completion form with "actual total" | Simplify | Spec: add items on the day; total derives from items |
| Booking detail: manual payment | Keep | Add method list and status guard |
| Booking detail: balance link (copy URL) | Simplify | Becomes "Send on WhatsApp" with a PaymentLink token |
| Booking detail: cancel, no-show, reinstate | Keep | Reinstate uses the capacity check |
| Booking detail: private note, activity log | Keep | Activity collapsed by default |
| Customers list | Keep | Add phone search and badges |
| Customer detail | Keep | Extend with profile stats per 6.5 |
| Settings: Services tab | Keep | Extend for add-ons; drop the demo or approved status |
| Settings: Availability and deposit tab | Keep | Add buffer, weekday capacity, Blocks, deposit scope; drop default duration if D4a removes null durations |
| Settings: Needs owner confirmation checklist | Remove | Becomes the developer's launch checklist in docs |
| Settings: Business facts panel with Verified badges | Remove | Replaced by Salon details settings (D4c) |
| Reset demo data | Remove | Dangerous in production |
| `/styleguide` (public) | Remove | Development aid only |
| Mock checkout page and API | Remove | Replaced by Paystack |


## 8. Risks and open questions

**Conclusion:** the biggest risk is whether Workers can run this app on the free plan (H0), now checked near the end by your choice. The portability rules keep a switch to Netlify cheap if it fails.

**Risks**
1. **Late hosting check.** Checking Workers at the end means a failure is found late. The portability rules in Section 4 keep the cost low, and Netlify is the Spec's fallback, which runs the same Node code.
2. **Workers free plan limits.** Compressed bundle size and per-request CPU time (I believe the free plan allows about 10 ms of CPU per request; confirm current limits). Prisma, server rendering and password hashing all spend CPU. H0 measures this near the end. Fallback is Netlify per Spec.
3. **Next.js 16.4 on OpenNext.** Support for `proxy.ts`, Cache Components and partial prefetching on the Cloudflare adapter is unverified. H0 checks it. Static and regenerated pages may need an incremental cache binding (R2 or KV), which is another dashboard step.
4. **Prisma through Supabase's transaction pooler.** Transaction-level advisory locks (`pg_advisory_xact_lock`) work in transaction mode; session locks do not. Use only the transaction form.
5. **Duplicate charge despite the design.** If a customer ever pays twice (two popups, two devices), the second payment is recorded and the booking shows overpaid. Since the salon does not refund, the owner needs a stated policy: credit or manual refund in the Paystack dashboard, recorded as an `adjustment`. Needs your answer.
6. **Bundled admin password on Render.** If the Render prototype is public, the demo password is readable in the page's JavaScript. Take it down or change it.
7. **Resend limits.** 100 emails a day: confirmations plus reminders plus one summary is fine at about 100 bookings a week, but a backlog after an outage could hit the cap. The daily-limit stop handles it.
8. **Supabase pausing.** Hourly cron should prevent it; confirm after week one (Spec 6.10).

**Open questions**
1. ~~What Paystack does with a wrong-amount transfer~~ Answered by P6, below.

**P6 result: wrong-amount bank transfer (tested 20 Nov 2026, Paystack test mode)**
- Test mode can't send a wrong amount. The Transfer tab offers one button, "I've sent the money", for the exact sum. Test-transfer deposits for the right amount confirmed through the webhook in under a minute.
- Paystack's help centre ("Pay with transfer") says these transfers are refunded to the customer automatically and never reach us as a charge:
  - a transfer for the wrong amount;
  - extra transfers to the same generated account (only the excess goes back);
  - a transfer after the account's 30 minute window.
- Our handling:
  - No code path is needed for a mismatched transfer, because Paystack never reports it as successful.
  - If a short charge ever does arrive (Verify reports less than the attempt asked), it is recorded as received. The booking goes to `needs_attention` and the audit entry says to collect the difference. An overpayment is recorded as received and noted in the audit entry. Both cases are covered by tests.
- Customer side: Paystack's transfer screen shows the exact amount to send. A customer whose wrong-amount transfer was refunded sees the booking still awaiting its deposit, and can pay again before the hold ends.

**Payment fees (decided 20 Nov 2026): the customer pays Paystack's fee**
- "Pass fees to customers" is on in the Paystack dashboard, and `PAYSTACK_CUSTOMER_PAYS_FEES="true"` mirrors it. Paystack adds its fee to the charge (1.5%, plus ₦100 from ₦2,500, capped at ₦2,000), so the salon receives the full deposit or balance. Checked in test mode: ₦2,000 became ₦2,030.46, and ₦3,000 became ₦3,147.21, matching our estimate.
- Only Paystack's `requested_amount` counts toward a booking. The customer's fee (`customerFeeKobo`) and Paystack's whole fee (`paystackFeeKobo`) are kept on the payment row for the finance pages. A charge whose `requested_amount` differs from what we asked is refused.
- Customers see the fee and the total before Paystack's window opens: on the review step, the booking page and `/pay`.
- To confirm on the first live settlement: whether VAT is added to Paystack's fee, and whether stamp duty applies to transfers of ₦10,000 or more.

**Follow-ups found in the payments review (20 Nov 2026)**
- M5: the cron run should also verify payment attempts left open for more than an hour. That is the backstop if both the webhook and the customer's browser miss a payment.
- M7: the attention box needs rows for webhook events marked `failed` (for example a currency or amount mismatch), and for overpaid bookings, such as an online balance that landed after cash was recorded.
- M9: check the start-payment rate limit (10 per IP per 10 minutes) against Nigerian mobile networks, where many customers share one address.
2. Expiry for customer links: I suggest confirmation links expire 30 days after the appointment and balance links 30 days after creation or once paid. Confirm.
3. Are "services and prices, about, contact" separate pages at launch or sections of the home page as now? I recommend sections at launch, separate pages later.
4. Data deletion under NDPA when the ledger is append-only: anonymise the customer and keep payment rows? Needs advice.
5. Real values from the client (Spec 9): services, add-ons, prices, durations, deposit rule, capacity, buffer, hours, address, WhatsApp number, owner email, existing customer list, photos with consent.

**Dashboard steps that need you** (I will give click-by-click instructions at each one, then verify with a test call)
| Service | Steps | When |
| - | - | - |
| Supabase | Create production (and staging per D5) projects; copy pooled and direct strings; turn off Data API or confirm RLS; check backup options | Before H1 |
| Paystack | Test keys; webhook URL; test card and test transfer; client invites you with a developer role, not owner; 2FA for every team member; transfer OTP left on; live keys and live webhook at go-live | P2 to P6, H4 |
| All accounts | 2FA on GitHub, Cloudflare or Netlify, Supabase, Resend, cron-job.org, and the owner's email inbox | Before go-live |
| Resend | Add domain; DNS records including DMARC; API key; test email; webhook later | H3; webhook in week one |
| Cloudflare | Add domain; deploy Worker; set secrets; check bot and AI crawler settings; possibly an R2 or KV binding for caching | H0, H2 |
| cron-job.org | Hourly job with `CRON_SECRET` header; failure email alerts | H5 |
| Google Search Console | Verify domain; submit sitemap | H6 |
| GitHub | Secret scanning and Dependabot on; Actions enabled | S6, D4 |
| Render | Take the prototype down | H8 |
