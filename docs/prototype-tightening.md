# 02 · Prototype tightening

**Scope:** fixes and hardening that make sense **while the project still runs on mock data**.
**Branch:** `prototype-tightening`.
**Related:** [01 · Findings](findings-and-recommendations.md) · [03 · Production readiness](production-readiness.md)

## Ground rules

- **Stay a prototype.** No database, no Paystack, no real notifications, no new infrastructure.
  Those belong in [document 03](production-readiness.md).
- **No new runtime dependencies** unless a task says so. Dev dependencies for testing are fine.
- **Keep the labels.** Preview banners, "demo" markers and `robots: noindex` stay on.
- **Keep the seams.** Do not move I/O into `src/domain` or `src/lib`.
- **Next.js 16:** read the relevant guide in `node_modules/next/dist/docs/` before touching
  routing, caching, `proxy.ts` or metadata.
- **Every task is done when:** `npm run lint`, `npx tsc --noEmit`, `npm run build` and the test
  suite (once T-10 lands) all pass.

Each task maps to a finding ID in document 01.

## Priority 1 · Data exposure and booking integrity

### T-01 · Stop cross-customer exposure (F-01)

**Problem:** booking with another person's phone or email attaches the booking to their customer
record. The booking page then links to all of that customer's bookings with valid tokens.

**Fix:**
- Remove `token` from the `history` rows in `getCustomerBooking` (`src/server/queries.ts`).
- On the booking page, show other bookings as plain text (reference, date, status) or remove the
  section. Do not link them.
- In `findOrCreateCustomer`, keep matching for the admin's benefit, but never show the stored
  customer name or contact details on a page reached by a new, unverified booking. Display the
  name typed for that booking instead. This needs a `contactName` snapshot on the booking.

**Done when:** creating a booking with a seeded customer's phone number reveals none of that
customer's name, email, other references or tokens.

### T-02 · Require the booking token on checkout (F-02, F-03)

**Fix:**
- `/checkout/[reference]` requires `?t=<accessToken>` and returns `notFound()` without a match.
- `POST /api/checkout/[reference]` requires `token` in the body and checks it.
- Update the redirects in the booking wizard, the pay button and the admin balance link.

**Done when:** the checkout page and the mock-pay endpoint both return 404 for a valid reference
with a missing or wrong token.

### T-03 · Make reinstatement use the real availability check (F-04)

**Fix:** in `setBookingStatus`, replace the hand-written clash check with `blockingIntervals(db.bookings, nowMs, b.id)`
and compare the overlap count against `settings.availability.concurrentCapacity`. Run
`sweepExpiredHolds` first.

**Done when:** reinstating a cancelled booking over a live unpaid hold is rejected with `SLOT_TAKEN`,
and capacity 2 allows two overlapping bookings but not three.

### T-04 · Guard manual payments (F-05)

**Fix:** in `recordManualPayment`, reject `cancelled`, `expired` and `no_show` bookings with
`NOT_ALLOWED`. Allow "towards deposit" only when the booking is `awaiting_deposit`.

### T-05 · Do not lose state on throw (F-06)

**Fix:** in `completeMockCheckout`, return a result for the "deposit no longer needed" case instead
of mutating and then throwing. The abandoned state then persists.

## Priority 2 · Abuse resistance (in-memory is fine)

### T-06 · Rate limit the three open doors (F-08)

**Fix:** add a small in-memory limiter (`src/server/rate-limit.ts`, a `Map` keyed by IP plus action,
fixed window). Apply it to:

| Endpoint | Suggested limit |
|---|---|
| `loginAction` | 5 attempts per 15 minutes per IP |
| Find my booking | 10 lookups per 15 minutes per IP |
| `POST /api/bookings` | 5 per 10 minutes per IP |

Return a clear message and HTTP 429 from route handlers. Document in the file that this is
single-process only and is replaced in production.

### T-07 · Cap unpaid holds (F-09)

**Fix:** in `createPendingBooking`, reject a new booking when the same phone or email already has
one live `awaiting_deposit` hold. Point the customer to their existing checkout.

### T-08 · Take credentials out of the repo (F-10)

**Fix:**
- Read the demo admin email and password from `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD`,
  falling back to the current values **only when `NODE_ENV !== "production"`**.
- In production, throw at startup if `DEMO_SESSION_SECRET` or the admin variables are missing.
- Hide the "Fill demo credentials" button when `NODE_ENV === "production"`.
- Add the two variables to `render.yaml` (`sync: false`) and to `.env.example`.

**Done when:** a production build with no env vars refuses to start, and the deployed admin cannot
be opened with values read from GitHub.

### T-09 · Security headers (F-11)

**Fix:** add `headers()` to `next.config.ts` with `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Strict-Transport-Security` and a `Permissions-Policy`. The `Referrer-Policy` also limits leakage
of the `?t=` token (F-12). Leave a full CSP for document 03.

## Priority 3 · Engineering basics

### T-10 · Tests (F-13)

**Fix:** add Vitest as a dev dependency and an `npm test` script. Cover, in this order:

1. `src/domain/availability.ts`: hours, lead time, horizon, capacity, live versus expired holds, closed days.
2. `src/domain/pricing.ts`: percent and fixed deposits, minimum, unpriced items, balance due, overpayment.
3. `src/domain/validation.ts`: Nigerian phone formats, email, "phone or email required".
4. `src/server/booking-service.ts`: create → pay → confirm, double-book rejected, expired hold,
   idempotent resolve, and one regression test for each of T-01 to T-05.

The service tests need the store pointed at a temporary directory through `DEMO_DATA_DIR`, and a
way to stub `server-only`.

### T-11 · CI (F-14)

**Fix:** add `.github/workflows/ci.yml` that runs `npm ci`, lint, `tsc --noEmit`, tests and build
on every push and pull request, using the Node version in `.node-version`.

### T-12 · Error and not-found pages (F-15)

**Fix:** add `src/app/not-found.tsx`, `src/app/error.tsx` and `src/app/global-error.tsx` in the
site's visual language, each with a link home and the salon phone number.

### T-13 · Housekeeping (F-07, F-16, F-17)

- Log persist failures in `store.ts` with `console.error` instead of swallowing them.
- Add `.env.example` listing `DEMO_SESSION_SECRET`, `DEMO_DATA_DIR`, `NEXT_PUBLIC_PREVIEW_MODE`
  and the T-08 variables.
- Delete the unused scaffold SVGs in `public/`.
- Validate `open` and `close` as `HH:MM` in `settingsAction`.
- Update the README to match every change above.

## Priority 4 · Verify by hand

These were not exercised in the review. Walk through each once on a phone-sized viewport and on
desktop, and log any defect as a new finding in document 01.

- Booking wizard: all four steps, back navigation, draft restore, slot-taken recovery, no-slots state.
- Mock checkout: success, failure, retry, hold countdown reaching zero.
- Admin: completion form with extras, manual payment, cancel, no-show, reinstate, settings save, reset.
- Keyboard-only navigation and visible focus on the wizard and the admin forms.

## Suggested order

T-01 → T-02 → T-03 → T-04 → T-05 → T-10 → T-11 → T-08 → T-06 → T-07 → T-09 → T-12 → T-13 → hand verification.

Fix the High finding first, then put tests in place before the wider hardening.

## Out of scope here

Real database, Paystack, real authentication, notifications, reschedule and refund flows,
owner-approved content, SEO, analytics and monitoring. All are in
[document 03](production-readiness.md).
