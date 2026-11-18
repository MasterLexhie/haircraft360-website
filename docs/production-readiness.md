# 03 · Production readiness

**Scope:** what is strictly needed to move from a fully tightened prototype to a live site that
takes real bookings and real money.
**Precondition:** every task in [02 · Prototype tightening](prototype-tightening.md) is done.
**Related:** [01 · Findings](findings-and-recommendations.md)

> AI agents: this repo runs Next.js 16. Read the matching guide in `node_modules/next/dist/docs/`
> before each phase. Third-party details below (Paystack, crawler names, schema types) were written
> from general knowledge on 16 Nov 2026. Confirm each against the provider's current documentation
> before implementing.

## Launch gates

The site must not go live until all of these are true.

| # | Gate |
|---|---|
| G1 | Bookings, customers and payments live in a real database with tested backups. |
| G2 | The database itself prevents overlapping bookings. |
| G3 | A booking is confirmed only by a signature-verified Paystack event. |
| G4 | The admin sits behind real authentication with no credentials in the repo. |
| G5 | The customer and the owner are both notified of a new booking. |
| G6 | Every business fact, price, policy and photo is owner-approved. |
| G7 | A privacy policy and booking terms are published. |
| G8 | All mock and demo code paths are removed or unreachable. |
| G9 | Errors are monitored and someone is alerted. |
| G10 | The public pages are indexable, with structured data and a sitemap. |

## Phase 0 · Owner decisions (start now, no code)

These block content, pricing logic and legal pages. The live list is the checklist in
Admin → Settings (`OWNER_CHECKLIST` in `src/mock/demo-config.ts`).

- Service menu: names, descriptions, prices, durations.
- Opening hours and public-holiday exceptions.
- Deposit rule, plus cancellation, refund, reschedule and late-arrival terms.
- Number of chairs or stylists working at once.
- Business name, address, map pin, phone, WhatsApp, social profiles.
- Real photos of the salon's work, with client consent.
- Notification channels (email, SMS, WhatsApp) and who receives owner alerts.
- Which manual payment methods the owner may record.
- A Paystack business account (needs the owner's business and bank details).
- A domain name.

## Phase 1 · Database (G1, G2)

Replace `src/server/store.ts`.

- **Engine:** managed Postgres.
- **Schema:** `customers`, `services`, `bookings`, `booking_lines`, `payments`, `settings`,
  `audit_events`, `admin_users`. The shapes in `src/domain/types.ts` map across directly.
- **No double-booking at the database level:** an exclusion constraint on the booking time range
  for blocking statuses, or a serialisable transaction with row locks. With capacity above 1,
  model chairs as rows and constrain per chair.
- **Migrations:** versioned and run in the deploy pipeline.
- **Async data layer:** `transaction()` is synchronous today. Every caller in
  `booking-service.ts` and `queries.ts` becomes `async`. Keep `src/domain` pure.
- **Hold expiry:** keep the lazy sweep, and add a scheduled job so holds expire without traffic.
- **Remove:** `isDemo` flags, `src/mock/seed.ts` from the production path, and "Reset demo data".
- **Backups:** daily automated backups, point-in-time recovery if the plan allows, and one
  **tested restore** before launch.
- **Audit:** `audit_events` is append-only, with a retention period agreed with the owner.

## Phase 2 · Admin authentication (G4)

Replace `src/server/auth.ts`, `DEMO_ADMIN` and the login form's demo helpers.

- A maintained auth library or a hosted identity provider. Do not hand-roll password storage.
- Per-person accounts, strong password hashing (argon2id or bcrypt), and MFA for the owner.
- Durable rate limiting and lockout on login.
- Server-side sessions with rotation, `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
- Keep `requireAdmin()` on every admin page and every server action.
- A password reset flow.
- The real admin user recorded as `actor` in the audit trail.

## Phase 3 · Paystack (G3)

Replace `src/server/payments/mock-checkout-adapter.ts`. Delete `/api/checkout/[reference]`,
`/checkout/[reference]` and `src/components/booking/mock-checkout.tsx`.

- **Initialise server-side** with the secret key. Amounts are already integer kobo, which is the
  unit Paystack expects for NGN.
- **One unique reference per attempt**, stored before redirecting the customer.
- **Webhook endpoint:** verify the `x-paystack-signature` header (HMAC SHA-512 of the raw body
  with the secret key) before parsing. Reject anything that fails.
- **Verify again:** call Paystack's verify-transaction endpoint and compare amount, currency and
  reference against the stored payment.
- **Never trust the browser redirect.** The callback page only reads state from the database.
- **Idempotency:** keep the current rule that a reference leaves `pending` exactly once. Enforce
  it with a unique constraint and a conditional update.
- **Late payment after an expired hold:** decide the policy with the owner (re-confirm if the slot
  is still free, otherwise refund), and implement it explicitly.
- **Refunds:** at minimum, a documented manual process in the Paystack dashboard, recorded as a
  payment entry in the admin.
- **Reconciliation:** an admin view that lists gateway payments against bookings and flags mismatches.
- **Keys:** test and live keys in environment variables only. Run the full flow in Paystack test
  mode before switching.

## Phase 4 · Notifications (G5)

- **Customer:** booking confirmed (with the booking link), deposit receipt, balance request,
  cancellation, and a reminder before the appointment.
- **Owner:** new confirmed booking, cancellation, failed or disputed payment.
- **Channels:** start with email through a transactional provider. Add SMS or WhatsApp if the
  owner chooses; SMS reaches more customers in Nigeria than email.
- **Delivery:** send from a queue or background job with retries, never inside the request that
  takes the payment.
- **Email deliverability:** SPF, DKIM and DMARC on the sending domain.

## Phase 5 · Customer access and privacy (G7)

- **Booking links:** replace the permanent `?t=` token with a signed, expiring link.
- **Identity:** verify the phone or email (one-time code) before showing any booking history or
  merging into an existing customer record. This closes finding F-01 properly.
- **Find my booking:** durable rate limiting; send the link to the contact on file instead of
  showing the booking directly.
- **Privacy policy and booking terms:** published and linked from the footer and the booking form.
- **Nigeria Data Protection Act 2023:** take advice on obligations. At minimum: a lawful basis and
  clear notice at the point of collection, a contact for data requests, a retention period, and a
  way to delete a customer's data.
- **Consent:** only load analytics or marketing scripts after consent.

## Phase 6 · Platform and operations (G8, G9)

- **Hosting:** an always-on paid instance in a region close to Nigeria. No sleeping; a 30–60
  second cold start loses bookings. Confirm the host suits a long-running Next.js server.
- **Domain and HTTPS:** custom domain, HSTS, redirect `www` and `http` to one canonical origin.
- **Environments:** separate staging and production, each with its own database and Paystack keys.
- **Rate limiting:** move the in-memory limiter to a shared store, or use the host's edge limits.
- **Content Security Policy:** a full CSP covering Paystack, fonts and analytics.
- **Monitoring:** error tracking, uptime checks on `/` and a `/api/health` route that checks the
  database, structured logs, and alerts to a real person.
- **Remove prototype surface:** `/styleguide` out of production or `noindex`, all "prototype",
  "demo" and "stock stand-in" labels gone, `NEXT_PUBLIC_PREVIEW_MODE=false`, `PREVIEW_MODE` code
  deleted once nothing depends on it.
- **Caching:** the service list and settings change rarely. Cache them with the Next.js 16 cache
  APIs and invalidate on admin save. Availability and booking pages stay dynamic.
- **Tests:** end-to-end tests (Playwright) for book → pay → confirm and the admin completion
  flow, running in CI against staging with Paystack test mode.
- **Accessibility:** WCAG 2.2 AA pass on the booking wizard and checkout hand-off.
- **Performance:** measure Core Web Vitals on a mid-range Android phone over a slow connection,
  which is the realistic customer device. Compress and correctly size all real photos.

## Phase 7 · SEO (G10)

The prototype is deliberately `noindex` (`src/app/layout.tsx`). Nothing below should ship until G6
is met; do not index demo content.

### Technical

- **Indexing:** remove `robots: { index: false }` from the root layout. Keep `noindex` on
  `/admin/*`, `/booking/*`, `/checkout/*` and `/styleguide`.
- **`metadataBase`** set to the production origin, with a canonical URL on every public page.
- **`src/app/robots.ts`:** allow public pages, disallow `/admin`, `/api`, `/booking/`, and point to the sitemap.
- **`src/app/sitemap.ts`:** home, booking, each service page, and any content pages.
- **Titles and descriptions:** unique per page, written for a person searching in Ibadan. Remove
  "(prototype)" from the default title.
- **Open Graph and Twitter cards:** a real 1200×630 image, since links will mostly be shared on WhatsApp and Instagram.
- **Icons and manifest:** proper favicon set, `apple-icon`, and a web manifest.
- **Server-rendered content:** all indexable text must be in the HTML response. It is today; keep it that way.

### Structured data (JSON-LD)

Follow `node_modules/next/dist/docs/01-app/02-guides/json-ld.md`.

- **`HairSalon`** (a schema.org `LocalBusiness` subtype) on the home page: `name`, `address`,
  `geo`, `telephone`, `openingHoursSpecification`, `url`, `image`, `priceRange`, `sameAs` (social
  profiles and the Google Business Profile).
- **`Service` / `Offer`** entries for each service with price in NGN.
- **`FAQPage`** on the FAQ content.
- **`aggregateRating`:** only if the reviews are collected and shown on this site. Do not mark up
  the Google rating as the site's own.
- Generate all of it from the same source as the visible page so they can never disagree.

### Local SEO (this is where a salon wins)

- **Google Business Profile:** claimed and verified by the owner, with the booking link set to
  `/book`, correct hours, categories, services and real photos.
- **NAP consistency:** name, address and phone identical on the site, Google, Instagram and any directory.
- **Location in the content:** "Ibadan", the area (Basorun) and the landmark, in natural sentences.
- **Reviews:** a simple post-appointment prompt asking for a Google review.
- **Google Search Console and Bing Webmaster Tools:** verify the domain and submit the sitemap.

### Content

- **A page per service** (`/services/[slug]`): what it is, who it suits, how long it takes, the
  price or price range, aftercare, real photos. The home page cards link to them.
- **An about page:** who the loctician is, experience, approach.
- **A gallery** of real work with descriptive alt text.
- **An FAQ page** answering the questions customers actually ask: deposit, cancellation, how long
  starter locs take, how often to retwist, what to do before an appointment.

## Phase 8 · SEO for generative AI (GEO)

AI assistants answer questions like "where can I get starter locs in Ibadan?" by retrieving and
summarising pages. The goal is for the salon's facts to be easy to retrieve, unambiguous and
consistent everywhere. Most of this builds on Phase 7.

- **Let the right crawlers in.** In `robots.ts`, decide explicitly per agent. To appear in AI
  answers, allow the search and retrieval agents (for example `OAI-SearchBot`, `ChatGPT-User`,
  `Claude-SearchBot`, `Claude-User`, `PerplexityBot`). Training crawlers (for example `GPTBot`,
  `ClaudeBot`, and the `Google-Extended` token) are a separate choice for the owner. Agent names
  change; check each vendor's current list.
- **Do not block them by accident.** Check that the host's firewall or bot protection is not
  challenging these agents.
- **No JavaScript required.** Many AI fetchers do not run scripts. Service names, prices, hours,
  address and phone must be in the server HTML as text, not only inside interactive components or images.
- **Answer-shaped content.** Write short, self-contained, factual passages under question
  headings: "How much do starter locs cost at Haircraft360?", "How long does a retwist take?".
  One fact per sentence, with numbers, units and the currency.
- **Facts page.** One plain page stating who, what, where, when, how much and how to book. This is
  the page an assistant can quote from.
- **Structured data.** The Phase 7 JSON-LD is the machine-readable version of the same facts.
- **Consistency across the web.** Assistants cross-check sources. The site, the Google Business
  Profile, Instagram and directories must agree on name, address, hours and prices.
- **Freshness.** Show a visible "last updated" date on prices and hours, and keep `lastModified`
  accurate in the sitemap.
- **Third-party mentions.** Reviews and mentions on Google, Instagram and local directories carry
  weight that the site cannot give itself.
- **`/llms.txt` (optional).** A short Markdown summary of the business with links to the key
  pages. It is a proposed convention with uneven adoption, so treat it as low cost and low
  certainty, not a substitute for the items above.
- **An actionable booking path.** A stable, crawlable `/book` URL and a visible phone number, so
  an assistant can send the customer somewhere that works.
- **Measure it.** Track referrals from AI assistants in analytics, and periodically ask the main
  assistants the target questions to see whether and how the salon is described.

## After launch (not required for day one)

- Customer-side reschedule and cancel.
- Automated refunds through the Paystack API.
- Multiple stylists with individual calendars.
- A timezone library if the business expands beyond Lagos time.
- Loyalty, packages or gift cards.

## Suggested order

Phase 0 runs in parallel with everything. Then: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

Phases 7 and 8 are last because they depend on approved content (G6), not because they matter
less. For a local salon, the Google Business Profile and the service pages are likely to bring
more bookings than any other single item in this document.
