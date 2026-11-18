# Haircraft 360 Website: Build Spec for Launch and Iterations

This document is written for an AI coding agent (Claude Code) working in the existing Haircraft 360 repository, with the developer (Precious) reviewing and deciding. It describes what must ship for the live launch, what follows in the first two weeks, and what comes later. Place it in the repo at `docs/BUILD_SPEC.md`.

## 1. How the agent should use this document

1. **Analyse before building.** Read the existing codebase and the requirements document first. Then write `docs/analysis/gap-report.md` that maps every item in Section 6 (Launch scope) to the codebase as one of: done, partly done, or missing, with file paths. Stop and wait for review before changing code.
2. **Fit into what exists.** Reuse the prototype's components, routes and styling where they work. Propose replacements only where the existing code conflicts with this spec, and explain why.
3. **Work in small, reviewable steps.** One feature area at a time, each with its own migration (if any), tests and a short summary of what changed.
4. **Never put client specifics in code.** Prices, durations, deposit rules, capacity, buffers, opening hours and message wording are admin settings or seed data. Ask the developer for real values; use clearly fake placeholders until then.
5. **Guide the human through dashboard work.** Some setup can only be done by a person in a web dashboard (Paystack, Resend, Supabase, Cloudflare, cron-job.org, Google Search Console). When a step needs this, stop and give the developer numbered, click-by-click instructions, say exactly which value to copy and which environment variable it goes into, then verify the result in code or with a test call before moving on. Section 11 lists these setups.
6. **Protect data integrity above speed.** Anything touching bookings, payments or customer merging must be transactional and covered by tests. If unsure, ask.
7. **Writing style.** Never use double dashes in any document, comment or UI text.

## 2. Product context

Haircraft 360 is a hair salon. The website lets customers book services online without creating an account, pay a deposit to reserve the booking, and later pay the balance. The owner runs everything from an admin area: bookings, customers (a simple CRM), payments and expenses. The owner is not technical, so the admin must explain itself in plain language and only ask for a developer when something is genuinely broken.

- Market: Nigeria. Currency NGN, stored in kobo as integers. Time zone `Africa/Lagos` (UTC+1, no daylight saving).
- Customers do not choose a stylist. Stylists are allocated in person, and the salon can serve several customers at the same time.
- Phone number is required at booking. Email is optional.
- Deposits are not refunded by the salon, so double bookings and duplicate charges must be impossible by design.
- Expected volume is low (around 100 bookings a week at most).
- Target: live and tested before the end of November 2026, hosted at $0 for roughly the first two months.

## 3. Decisions already made (do not revisit without asking)

- **Stack:** full-stack Next.js (App Router), TypeScript, Prisma, PostgreSQL. All database access happens on the server only.
- **Database:** PostgreSQL on Supabase (free plan), used purely as Postgres through Prisma. Supabase's auto-generated public API is not used.
- **Hosting:** Cloudflare Workers via the OpenNext adapter (`@opennextjs/cloudflare`) as the first choice. Fallback is Netlify if the compressed bundle exceeds the Workers free limit or a required feature is unsupported. Vercel is ruled out. No Docker.
- **Payments:** Paystack, under the salon's own Paystack account. Development uses test keys; go-live is a key swap with no code changes. Checkout uses Paystack's inline popup so the customer never leaves the site.
- **Email:** Resend, through its official SDK (not Nodemailer). Free plan: 100 emails a day, 3,000 a month.
- **Scheduler:** cron-job.org calls a protected route in the app every hour. No in-process schedulers like node-cron.
- **WhatsApp:** no WhatsApp API at launch (it is paid). The admin uses `wa.me` links with pre-filled messages that the owner sends with one tap.
- **No push notifications:** the admin is not an installable web app.
- **No third-party error tracker** (such as Sentry) at launch. Errors are stored on the records they affect (see Section 6.4 and 6.3).
- **Google Calendar sync is out of scope for launch.**

## 4. Environment variables

Never commit real values. Keep a `.env.example` with every name and a short comment. Public values (safe in the browser) start with `NEXT_PUBLIC_`; everything else must only ever be read on the server.

| Variable | Used for | Where it comes from |
| --- | --- | --- |
| `DATABASE_URL` | Prisma runtime connection (local Postgres in development, Supabase pooled connection in production) | Local install, then Supabase dashboard, database connection settings |
| `DIRECT_URL` | Prisma migrations (direct connection) | Local install, then Supabase dashboard (direct connection string) |
| `PAYSTACK_SECRET_KEY` | Server calls to Paystack and verifying webhook signatures | Paystack dashboard, Settings, API Keys and Webhooks (test key first, live key at launch) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Opening the inline payment popup in the browser | Same page as above |
| `EMAIL_TRANSPORT` | `console` or `mailpit` in development, `resend` in production | Set per environment |
| `RESEND_API_KEY` | Sending email | Resend dashboard, API Keys |
| `RESEND_WEBHOOK_SECRET` | Verifying Resend delivery and bounce webhooks (Phase 2) | Resend dashboard, Webhooks |
| `EMAIL_FROM` | Sender, for example `Haircraft 360 <bookings@yourdomain>` | A verified domain in Resend |
| `OWNER_NOTIFICATION_EMAIL` | Where owner alerts and the daily summary go | The client |
| `CRON_SECRET` | Protects the scheduled route; sent by cron-job.org as a header | Generate a long random string |
| `AUTH_SECRET` | Signing admin session cookies | Generate a long random string |
| `NEXT_PUBLIC_SITE_URL` | Absolute links in emails, payment pages, sitemap | `http://localhost:3000` locally, then the production domain |
| `SALON_TIMEZONE` | Date maths, defaults to `Africa/Lagos` | Fixed |
| `DEVELOPER_CONTACT_WHATSAPP` | Number used by the admin's "Contact your developer" button | The developer |

Notes for the agent:

- Paystack signs webhooks with the secret key itself, so there is no separate Paystack webhook secret.
- On Cloudflare Workers, secrets are set with Wrangler or in the dashboard, not read from a deployed `.env` file. Check Prisma's current guidance for Workers (driver adapters and connection pooling) before wiring the database.
- If the hosting choice changes to Netlify, the same variable names are set in Netlify's environment settings.

## 5. Data model essentials (must be right on day one)

Screens can be added later; restructuring live data cannot. Before building features, make sure the schema supports all of the following. Adapt names to the existing prototype where sensible.

- **Customer:** display name, notes, tags, marketing consent, created date. One customer can have several phone numbers and several emails.
- **CustomerPhone / CustomerEmail:** normalised value (phones in E.164 such as `+2348031234567`, emails lowercased and trimmed), unique across all customers, plus a flag for emails that are placeholders or have bounced.
- **CustomerNameVariant:** every name the customer has typed, so changes in spelling are kept but never used for matching.
- **Service:** name, description, price, duration in minutes, `bookableAlone` flag, `availableAsAddOn` flag, optional add-on price and duration, active flag. A join table lists which add-ons each main service offers.
- **Booking:** reference, customer, start and end time (end includes all add-ons), status (`pending_payment`, `confirmed`, `completed`, `cancelled`, `no_show`, `expired`, `needs_attention`), hold expiry time, total price, deposit due, timestamps.
- **BookingItem:** one row per main service and each add-on, with the price and duration copied at the time of booking, so later price changes never alter past bookings.
- **Payment (append-only ledger):** booking, type (`deposit`, `balance_online`, `manual`, `adjustment`), method (card, transfer, cash, other), amount in kobo, Paystack reference (unique when present), status, who recorded it (for manual entries), note. Rows are never edited or deleted; corrections are new `adjustment` rows. Balance owed = booking total minus the sum of successful payments.
- **PaymentLink:** a long random token tied to one booking and one purpose (for example the balance), with expiry and used status. Customer-facing URLs use this token, never the booking ID.
- **WebhookEvent:** every incoming Paystack event (event type, reference, raw payload, processed status, error, received time). Used for idempotency and as evidence if a payment is ever disputed.
- **Notification:** booking, customer, type (`confirmation`, `reminder`, `owner_alert`, `owner_daily_summary`), channel (`email` or `whatsapp_manual`), status (`pending`, `sent`, `delivered`, `failed`, `skipped`, `bounced`), due time, attempts, last error, provider message ID. Unique on booking plus type.
- **Settings:** capacity (with per-weekday overrides), buffer minutes between appointments, opening hours, slot interval, hold duration, deposit rule (fixed amount or percentage, and whether it applies to the main service only or the full total), message templates, and a scheduler heartbeat timestamp.
- **Block:** admin-created periods that reduce capacity or close the salon.
- **Expense:** date, amount in kobo, category, payment method, note, created by, soft-delete flag.
- **ExpenseCategory:** editable list, seeded with: supplies and products, rent, power and diesel, staff pay, equipment, marketing, repairs, other.
- **AdminUser and AuditLog:** admin accounts, plus a log of admin actions (who did what, when, to which record).

## 6. Launch scope (must ship before go-live)

### 6.1 Booking flow (customer side)

1. Customer picks one main service (only services marked `bookableAlone`).
2. Customer optionally adds extras offered for that service. Each shows its price and extra time. A live summary shows total price and total duration. A clear Skip option.
3. Customer picks a date and a start time. Available times are calculated from the **total** duration including add-ons, so add-ons are chosen before time.
4. Customer enters name, phone (required) and email (optional), with a marketing consent checkbox. Bot protection uses a hidden honeypot field and server rate limits; no CAPTCHA or visible challenge.
5. Summary: each item and price, total, deposit due now, balance due later.
6. Customer pays the deposit in the Paystack inline popup without leaving the site (Section 6.3).
7. Confirmation page: booking details, "Add to Apple Calendar" (`.ics`) and "Add to Google Calendar" buttons (Section 6.4).

No customer accounts or logins. Never pre-fill or reveal an existing customer's details based on what is typed into the form.

### 6.2 Availability, capacity and double-booking protection

- Capacity = how many customers the salon can serve at the same moment (roughly the number of stylists working). Configurable per weekday, with admin Blocks to reduce capacity or close the salon for a period.
- Each booking occupies one unit of capacity from its start until its end **plus the buffer** (cleanup time). Example with capacity 2: an 8:00 four-hour booking and an 8:00 one-hour booking can both exist; with a 30 minute buffer the second unit frees at 9:30, so a new booking can start from 9:30.
- A time is available only if, at every moment of the new booking's duration plus buffer, the number of overlapping bookings is below capacity. Count `confirmed` bookings and `pending_payment` bookings whose hold has not expired.
- Holds: a pending booking holds its time for a configurable period (default 15 minutes). Expired holds are simply ignored when calculating availability, so no cleanup job is needed.
- **Race safety:** creating or confirming a booking runs inside one database transaction that first takes a transaction-level advisory lock for that salon and date, then re-checks capacity, then inserts or updates. A request that loses the race gets an honest "this time was just taken" message.
- Late payment after hold expiry: if capacity is still free, confirm normally. If not, set the booking to `needs_attention`, tell the customer the payment was received and the salon will contact them, and show it in the admin's attention box so the owner can move them to another time. The salon does not refund deposits, so the admin flow is "reschedule", not "refund".

### 6.3 Payments with Paystack

**Deposit**

1. Server creates the pending booking, then calls Paystack Initialize Transaction with: amount in kobo calculated **on the server** from service IDs (the browser never sends prices), the customer's email, a unique reference generated by us, and `metadata` containing the booking ID and payment type.
2. If the customer has no email, generate a placeholder such as `<phone>@noemail.<yourdomain>` (Paystack requires an email) and mark it as a placeholder so no email is ever sent to it.
3. The browser opens the Paystack inline popup with the returned access code. Card and bank transfer are both allowed.
4. **Only the webhook confirms payment, never the browser callback.** The webhook handler: verifies the `x-paystack-signature` header (HMAC SHA-512 of the raw request body using `PAYSTACK_SECRET_KEY`); stores the event in `WebhookEvent`; calls Verify Transaction with the reference; checks amount, currency and status match the booking; then, in one transaction, inserts the `Payment` row (unique on Paystack reference, so duplicates are ignored), confirms the booking (with the capacity re-check from 6.2) and creates its Notification rows. Respond 200 quickly; duplicates and retries must be harmless.
5. The browser callback only shows a "confirming your payment" state and polls our own server for the booking status.

**Balance**

- When a booking is completed, the balance = total minus successful payments (add-ons added on the day update the total).
- Admin action "Send balance link": creates a `PaymentLink` token and opens WhatsApp (`wa.me`) to the customer's number with a pre-filled message containing the link.
- The link opens a page on our site showing the service, total, deposit paid and balance, with a Pay button. **Each time the page's Pay button is pressed, start a fresh Paystack transaction** for the current balance (never reuse an old one, because Paystack's temporary transfer accounts expire). The same webhook flow records a `balance_online` payment.
- Before launch, test in Paystack test mode what happens if a customer transfers the wrong amount to a temporary account, and handle that outcome. Do not assume.
- **Manual payments:** admin can record cash, transfer to the salon's own account, or other, against a booking, with amount and note. Recorded in the ledger as `manual`, with who recorded it.

**Deposit rule:** fixed amount or percentage, applied to the main service only or to the full total, from Settings.

### 6.4 Notifications and reminders

All notifications are rows in the `Notification` table, created in the same transaction that confirms the booking. Sending happens separately, so an email outage never blocks a payment.

- **Customer confirmation email** (if a real email exists): booking details, deposit paid, balance due, salon address, an `.ics` attachment and both calendar buttons.
- **Customer reminder email** about 24 hours before the appointment.
- **Owner:** one daily summary email of new and upcoming bookings (keeps within Resend's 100 a day free limit). The admin always shows live bookings.
- **Calendar files:** serve `.ics` from an API route with content type `text/calendar`, a fixed UID per booking so reschedules update rather than duplicate, and times written in UTC. The Google Calendar button is a pre-filled event URL (works better on Android and in in-app browsers).
- **Scheduler:** route `/api/cron/notifications`, protected by a header that must equal `CRON_SECRET`. cron-job.org calls it hourly. Each run: records a heartbeat time; sends due notifications in a small batch and returns within a few seconds (cron-job.org times out after 30 seconds and does not retry); returns a tiny response such as `ok sent=3`.
- **Sending rules:** pass the notification ID as Resend's idempotency key; mark `sent` only after Resend accepts it and store the provider message ID; on failure increase attempts, store the last error and retry on later runs with increasing delays, then mark `failed`. If Resend reports the daily limit was reached, stop the batch without counting it as an attempt and continue after the reset.
- **Re-check before sending a reminder:** if the booking was cancelled, rescheduled or is already in the past, mark the row `skipped`.
- **Customers without a usable email:** they appear in the admin's "Reminders due" list with a WhatsApp button (`wa.me/<number>?text=<encoded message>` using the owner's editable templates). When the owner taps it, mark that reminder as sent so it is not shown again.
- Phone numbers are normalised with `libphonenumber-js` (default region NG) before storing or building WhatsApp links.
- Errors are not stored in a separate error log. They live on the records they affect: the Notification row (attempts, last error) and the WebhookEvent row (processed status, error). These IDs double as the reference code in the owner's "Contact your developer" button.

### 6.5 CRM essentials

- **Matching without login:** on each booking, normalise the phone. If it matches an existing customer, it is that customer. Otherwise, if the normalised email matches, it is that customer and the new phone is added to their profile. Otherwise create a new customer. Never match on name alone; store each typed name as a variant and display the latest.
- **New or returning:** a customer is returning if they have a completed booking before this one. Show a badge on each booking ("New" or "Returning, 5th visit") together with the customer's notes.
- **Customer profile:** all phones and emails, visits, total spend, average spend, last visit, usual services, no-shows, outstanding balance, notes, tags (for example VIP), marketing consent, and the booking and payment history.
- All matching runs on the server and never exposes another customer's data to the booking form.

### 6.6 Finances

Labels: **Revenue** (money in), **Expenses** (money out), **Net** (revenue minus expenses).

- **Add expense** form that works well on a phone: date (defaults to today), amount, category, payment method, optional note.
- **Finances page** with a period picker (today, this week, this month, custom) and three cards: revenue, expenses, net.
- **Daily table:** date, revenue, expenses, net, with a totals row. Use `generate_series` in SQL so days with no activity show as zero. Group by day in `Africa/Lagos`. Tapping a day shows its payments and expenses with notes.
- Expenses list with category filter. Expenses are soft-deleted and every change goes to the audit log.
- Revenue comes only from the Payment ledger.

### 6.7 Admin and owner experience

The owner must be able to run the business without a developer. Use plain words, never technical ones.

- **Dashboard:** today's appointments, upcoming bookings, this month's revenue, expenses and net with a comparison to last month, outstanding balances, most popular services, and new versus returning customers.
- **"Needs your attention" box:** shows only things the owner can act on, and says "All messages delivered" when there are none.

| What happened | What the owner sees | What they can do |
| --- | --- | --- |
| Email delivered or sent | Confirmation delivered / Reminder sent | Nothing |
| Temporary failure, still retrying | Nothing yet | Nothing |
| Email failed after retries or no usable email | Couldn't reach this customer by email | WhatsApp them, or fix the email |
| Daily email limit reached | Some reminders were delayed | WhatsApp those customers |
| Booking paid after its time was taken | Payment received, time needs changing | Move the booking to another time |
| Scheduler heartbeat older than two hours, or a system error | Reminders aren't running | Contact your developer |

- **"Contact your developer"** opens WhatsApp to `DEVELOPER_CONTACT_WHATSAPP` with a pre-filled message and a reference code (the related record ID).
- **On each booking:** plain-language message status labels, "Send on WhatsApp" buttons for confirmation, reminder and balance link, add items on the day, record manual payment, mark completed or no-show.
- **Reminders due:** tomorrow's bookings whose customers have no usable email, each with a WhatsApp button.
- **Settings:** services and add-ons, prices, durations, capacity, buffer, hours, holds, deposit rule, blocks, message templates, expense categories.
- The current admin prototype may show more than this. In the gap report, label each existing admin feature keep, simplify or remove, with a one-line reason.

### 6.8 Security (all required at launch)

- Database: only server code connects. Enable row-level security with no policies on every table (or disable Supabase's Data API) so the public API exposes nothing. Use SSL. Secrets only in environment variables; `.env` files in `.gitignore`; GitHub secret scanning on. Local development uses fake seed data, never real customer data.
- Server decides every price and amount. Validate every input on the server (for example with Zod).
- Paystack: signature check, then Verify Transaction, then amount and currency check, then idempotent insert.
- Admin authentication: hashed passwords, rate-limited login, secure, httpOnly, sameSite cookies, and a two-factor code from an authenticator app if time allows. Check permissions **inside every admin route handler and server action**, not only in middleware. Keep Next.js updated.
- Audit log for admin actions. Security headers (CSP, HSTS, X-Frame-Options or frame-ancestors, Referrer-Policy). Dependabot alerts on.
- Bots and abuse: Cloudflare in front of the site (free DDoS protection), a hidden honeypot field on the booking form, a limit on active pending holds per phone number, rate limits on booking creation and payment initialisation.
- Never show stack traces to users. Do not publish source maps publicly.
- Data protection: collect only what is needed. The salon's privacy policy should list its data processors (Supabase, Paystack, Resend, Cloudflare) and the marketing consent. The developer should have this checked; the agent should not present it as legal advice.

### 6.9 SEO and keeping private pages out of search

- Public pages (home, services and prices, about, contact, booking start) are statically generated or regenerated on change, so they load fast with full HTML.
- Proper titles and descriptions, Open Graph tags, a sitemap of public pages only, and `HairSalon` structured data (name, address, phone, opening hours, services, prices) for local and AI search.
- Every admin page requires login. Customer pages (confirmation, balance payment) use long random tokens, contain no personal data in the URL, and expire.
- All private and token pages send `noindex` (meta tag and `X-Robots-Tag` header).
- Do not list private paths in `robots.txt` (it is public and acts as a map).
- Add the site to Google Search Console to check what is indexed.

### 6.10 Hosting and deployment

- Build with the OpenNext Cloudflare adapter and check early that the compressed Worker fits the free plan limit and that Prisma works with Postgres on Workers. If either fails, switch to Netlify and report why.
- Supabase free projects pause after a week of too little activity. The hourly scheduler queries the database every run, which counts as activity. Confirm this in the Supabase dashboard after the first week.
- Custom domain on Cloudflare. Separate test and live environments for keys.

### 6.11 Pre-launch test checklist

- [ ] Two people booking the last free capacity at the same moment: only one succeeds.
- [ ] Duplicate and out-of-order Paystack webhooks create exactly one payment.
- [ ] Tampered amount or invalid signature is rejected.
- [ ] Payment after hold expiry: confirms if free, otherwise lands in the attention box.
- [ ] Bank transfer payment via temporary account, including a wrong amount.
- [ ] Balance link opened twice on different days still works.
- [ ] Reminder skipped for cancelled or rescheduled bookings; no duplicate reminders when the scheduler runs twice.
- [ ] Resend test addresses for delivered and bounced outcomes behave as expected.
- [ ] Phone normalisation for common Nigerian formats (0803..., 234803..., +234803...).
- [ ] Calendar buttons on iPhone Safari, Android Chrome and inside Instagram or WhatsApp's in-app browser.
- [ ] Admin pages unreachable without login; private pages carry noindex.
- [ ] Expense add, edit and soft delete; daily table totals match the ledger.

## 7. First two weeks after launch

- Possible duplicate customers list (similar names using Postgres `pg_trgm`, plus overlapping contacts) and a **Merge** action that moves bookings, payments, phones and emails in one transaction, with tests. Nothing merges automatically.
- CRM lists, each with WhatsApp buttons: due back (past their usual gap between visits), lapsed (no visit in 90 days), top spenders, new this month, no-show prone.
- Optional CSV import of the salon's existing customer records.
- Finance extras: expenses by category bars, revenue by type (deposit, online balance, manual), CSV exports.
- Resend webhooks (verified with `RESEND_WEBHOOK_SECRET`) to update notifications to delivered, bounced or complained; a bounce flags the email as unusable so the customer moves to the WhatsApp list.

## 8. Later and paid add-ons

- Automated WhatsApp reminders through the WhatsApp Business API, or SMS for customers without email (both paid per message).
- Two-way Google Calendar sync using a service account and a dedicated "Salon availability" calendar; free/busy checks remove blocked times from availability; our database remains the source of truth.
- Proactive monitoring and alerts as a paid maintenance service after the first month of support.
- Receipt photos, recurring expenses, budgets per category.
- Customers rescheduling their own bookings online; optional birthday field for birthday offers.
- An always-on paid database if the client wants a guarantee.

## 9. Inputs needed from the client

- Paystack account in the salon's name with business verification started, and the developer invited as a team member.
- Domain and DNS access (for the site, and for verifying the sending domain in Resend).
- Services: names, descriptions, prices, durations, which are add-ons, which add-ons go with which services.
- Deposit rule, capacity per weekday, cleanup buffer, opening hours.
- Owner notification email, the salon's WhatsApp number, address, and any existing customer list.

## 10. Open questions to confirm during the build

- What Paystack does when a customer transfers the wrong amount to a temporary account.
- Whether the app fits Cloudflare Workers' free bundle limit with Prisma.

## 11. Setup the agent must walk the developer through

For each item: give numbered steps, say which value goes into which variable, then verify with a test call before continuing.

1. **Supabase:** create the project, copy the pooled and direct connection strings into `DATABASE_URL` and `DIRECT_URL`, run migrations, enable row-level security on all tables.
2. **Paystack (test mode first):** copy test secret and public keys, set the webhook URL to `<site>/api/webhooks/paystack`, run a test card payment and a test transfer, confirm the webhook arrives and verifies. At go-live, the client invites the developer as a team member, then swap in live keys and set the live webhook URL.
3. **Resend:** add and verify the sending domain with the DNS records Resend gives, create an API key, send a test email, later add the webhook.
4. **Cloudflare:** add the domain, deploy the Worker, and set secrets.
5. **cron-job.org:** create the hourly job calling `/api/cron/notifications` with the `CRON_SECRET` header, enable failure email alerts, and confirm the heartbeat updates in the admin.
6. **Google Search Console:** verify the domain and submit the sitemap.

## 12. Local development first

Everything except real email delivery runs on the developer's machine first, against a seeded local Postgres database, before anything moves to Supabase, Cloudflare, Resend or cron-job.org.

- **Database:** native PostgreSQL (for example Postgres.app on macOS or the official installer). No Docker. `DATABASE_URL` and `DIRECT_URL` in `.env.local` point to the local database. Use `prisma migrate dev` for schema changes.
- **Seed script** (`prisma db seed`) with clearly fake data: services and add-ons, settings (capacity per weekday, buffer, hours, hold time, deposit rule, templates), one admin user, about 30 customers (some phone-only, some with several phones or emails, some with near-duplicate names), bookings in the past and future across every status, payments of every type, and expenses across all categories. The seed must be safe to rerun and must refuse to run if the database host is not local.
- **Moving to Supabase:** apply the same migrations with `prisma migrate deploy`. Production gets only the real services and settings, never fake customers.
- **Paystack locally:** test keys work as normal. Paystack cannot reach localhost, so expose the webhook route through a free tunnel (Cloudflare Tunnel with `cloudflared`, or ngrok) and set that URL as the test webhook URL in the Paystack dashboard.
- **Email locally:** an email adapter chosen by `EMAIL_TRANSPORT`. `console` prints each email to the terminal; `mailpit` sends to a local Mailpit inbox for viewing. Notification statuses update exactly as in production. Resend is only used in production.
- **Scheduler locally:** an npm script (for example `npm run cron`) that calls `/api/cron/notifications` with the `CRON_SECRET` header. Run it repeatedly to prove it never sends duplicates.
- **Running the app:** `next dev` day to day. Before the first deploy, run the OpenNext Cloudflare preview with Wrangler to catch anything Workers does not support.
- **Same variable names everywhere:** only values change between `.env.local` and the hosted environments.

Local is done when this whole path works on the developer's machine: booking with add-ons, deposit by test card and test transfer, webhook confirmation, confirmation email in the console or Mailpit, reminder from the cron script, balance link payment, manual payment, an expense, and correct totals on the Finances page.
