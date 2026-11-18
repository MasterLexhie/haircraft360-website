# 01 · Findings and recommendations

**Reviewed:** 16 Nov 2026, at commit `4b1c437` (`main`).
**Audience:** the developer and any AI agent working in this repo.
**Related:** [02 · Prototype tightening](prototype-tightening.md) · [03 · Production readiness](production-readiness.md)

> AI agents: read `AGENTS.md` first. This repo runs Next.js 16, whose APIs differ from older
> versions. Check `node_modules/next/dist/docs/` before writing code. Finding IDs (`F-01` …) are
> stable; reference them in commits and PRs.

## Verdict

Haircraft360 is a well-built, honest prototype, not a production system. The booking journey works
end to end on demo data and the domain logic is sound. The four things a real salon depends on are
mocked or absent: taking money, keeping data, securing the admin, and notifying people.

Most of the path to production is replacing three mock modules (store, auth, payments), not
rewriting the app.

## What the project is

A booking website for a loctician salon in Ibadan, Nigeria.

- **Customer side:** home page, 4-step booking wizard, deposit checkout, booking page, "Find my booking".
- **Owner side:** admin dashboard, bookings, customers, settings.
- **Stack:** Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, TypeScript, Tailwind 4.
- **Backend:** runs inside the Next.js server. All data lives in one JSON file plus server memory.
- **Hosting:** Render free-tier blueprint (`render.yaml`).

## How it was checked

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean |
| `npm run lint` | Clean |
| `npm run build` | Succeeds, 18 routes |
| HTTP smoke test against `next start` | Availability → create booking → double-book rejected → mock pay → repeat pay is idempotent |
| Token gate on `/booking/[reference]` | No customer data without the correct token |
| Admin gate | `/admin` redirects to login; all 10 data-changing server actions call `requireAdmin()` |

**Not checked:** the admin screens and the booking wizard were not clicked through in a browser.
Accessibility, mobile layout and performance were not measured.

## What is working

- **Availability** (`src/domain/availability.ts`): slots respect hours, lead time, horizon, capacity and live holds.
- **Atomic reserve** (`transaction()` in `src/server/store.ts`): safe for a single Node process.
- **Holds:** an unpaid booking blocks its slot for 15 minutes, then releases.
- **Money** (`src/lib/money.ts`, `src/domain/pricing.ts`): integer kobo, deposit rule, balance due, overpayment.
- **Idempotent payment resolution:** a checkout reference leaves `pending` exactly once.
- **Snapshots:** bookings keep the service name, price and duration from booking time.
- **Public/private separation:** customer queries strip `privateNote` and `accessToken`.
- **Admin settings validation:** numeric ranges and hours are validated server-side.
- **Honesty of the prototype:** preview banners, `robots: noindex`, hidden unverified rating, labelled demo values.

## Findings

Severity: **High** = exposes data or corrupts bookings · **Medium** = abuse or integrity risk · **Low** = hygiene.

### Defects in the current code

| ID | Severity | Finding | Where |
|---|---|---|---|
| F-01 | High | **Booking with someone else's phone or email exposes their bookings.** Customers are matched by phone or email with no proof of ownership. The new booking page then lists every booking for that customer with working token links. | `findOrCreateCustomer` in `src/server/booking-service.ts`; `history` in `getCustomerBooking`, `src/server/queries.ts`; rendered at `src/app/(site)/booking/[reference]/page.tsx:194` |
| F-02 | Medium | **The checkout page hands out the booking access token** to anyone holding the checkout reference. The reference is random (8 characters), so guessing is impractical, but it is a second, weaker key to the booking. | `getCheckout` in `src/server/queries.ts`; `src/app/(site)/checkout/[reference]/page.tsx` |
| F-03 | Medium | **Anyone with a checkout reference can mark it paid.** Expected for a mock, but it has no token check at all. | `src/app/api/checkout/[reference]/route.ts` |
| F-04 | Medium | **Reinstating a booking can double-book.** The clash check only looks at `confirmed`/`completed` bookings. It ignores live unpaid holds and the `concurrentCapacity` setting. | `setBookingStatus`, `src/server/booking-service.ts:304` |
| F-05 | Low | **Manual payments have no status guard.** A payment can be recorded against a cancelled, expired or no-show booking. | `recordManualPayment`, `src/server/booking-service.ts` |
| F-06 | Low | **A state change is silently lost.** `completeMockCheckout` marks a payment `abandoned` and then throws. `transaction()` discards the draft on throw, so the change never persists. | `src/server/booking-service.ts:196` |
| F-07 | Low | **Persist failures are swallowed.** If the JSON file cannot be written, the app carries on in memory with no log line. | `persist()` in `src/server/store.ts` |

### Abuse and hardening gaps

| ID | Severity | Finding | Where |
|---|---|---|---|
| F-08 | Medium | **No rate limiting anywhere.** Admin login, "Find my booking" and booking creation can all be hammered. | `loginAction`; `findBookingForCustomer`; `POST /api/bookings` |
| F-09 | Medium | **The calendar can be blocked for free.** Each booking request holds a slot for 15 minutes with no cap per contact or per IP. | `createPendingBooking` |
| F-10 | Medium | **Admin credentials are committed**, and the session secret has a hard-coded fallback. | `src/mock/demo-config.ts`; `src/server/auth.ts:9` |
| F-11 | Low | **No security headers** (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`). | `next.config.ts` |
| F-12 | Low | **Access token travels in the URL** (`?t=`), so it lands in browser history and server logs. | `/booking/[reference]` |

### Missing engineering basics

| ID | Severity | Finding |
|---|---|---|
| F-13 | Medium | **No automated tests.** The domain logic is pure and easy to test, and nothing protects it. |
| F-14 | Medium | **No CI.** Lint, type-check and build run only when someone remembers. |
| F-15 | Low | **No `error.tsx` or `not-found.tsx`.** Failures fall back to framework defaults. |
| F-16 | Low | **No `.env.example`.** The three environment variables are documented only in the README. |
| F-17 | Low | **Leftover scaffold files** in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). |

### Missing by design (prototype scope)

| ID | Gap |
|---|---|
| F-18 | No real payment gateway. Paystack is simulated. |
| F-19 | No durable storage. On Render's free plan, data is wiped on every sleep, restart or deploy. |
| F-20 | No real admin identity: one shared login, no password hashing, no MFA. |
| F-21 | No notifications to the customer or the owner. |
| F-22 | No reschedule, customer-side cancel, or refund flow. |
| F-23 | All business content is demo or unverified, including services, prices, hours, policies and photos. |
| F-24 | No SEO surface: the site is `noindex`, with no sitemap, robots file, structured data or social cards. |
| F-25 | No monitoring, error tracking, analytics or backups. |

## Recommendations

1. **Fix F-01 first.** It is the only finding that exposes one customer's data to another, and it
   carries straight into production if left in place.
2. **Tighten the prototype before building on it** (F-02 to F-17). These are small, contained
   changes. See [document 02](prototype-tightening.md).
3. **Add tests before the database swap.** Tests on availability, pricing and the booking service
   are the safety net for replacing `store.ts`.
4. **Start the owner conversation now.** Content, prices, deposit rule and cancellation terms
   (F-23) are the slowest dependency and need no engineering.
5. **Build production in this order:** database → admin auth → Paystack → notifications → SEO and
   launch hardening. See [document 03](production-readiness.md).
6. **Keep the seams.** `store.ts`, `auth.ts` and `payments/mock-checkout-adapter.ts` are clean
   replacement points. Keep the domain layer (`src/domain`, `src/lib`) free of I/O.
