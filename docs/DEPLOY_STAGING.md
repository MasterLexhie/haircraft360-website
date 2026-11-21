# Staging deployment guide (your accounts)

This guide puts the whole app online on **your own accounts** as a staging environment, so it can be tested end to end. The client's accounts become production later, using the same steps with their values, and only after you give the go-ahead.

**The setup:** Netlify Free (app) + Supabase Free (database) + cron-job.org (reminders) + Resend Free (email) + your Paystack account in **test mode** (payments).

**Ground rules:**
- Staging holds test data only. Nothing from staging is ever copied to production.
- Test data goes in through the app, never by writing to the database directly.
- Every account gets 2FA before anything is connected to it.
- Each step ends with a check. Don't move on until it passes.


## Stage 0: Code changes before the first deploy (Claude does these)

Each one is a separate commit that passes lint, types, tests and build.

| # | Change | Why |
| - | - | - |
| 0.1 | **Trusted IP header.** The rate limiter reads the visitor's IP only from the header the host sets (`TRUSTED_PROXY=netlify` reads `x-nf-client-connection-ip`), and ignores any other header a visitor sends. | Today anyone can fake `cf-connecting-ip` and get around the login, booking and lookup limits. |
| 0.2 | **Staging flag.** With `SITE_ENV=staging`: every page and response carries `noindex`, `robots.txt` blocks everything, and the admin shows a "Staging: test data" bar. | Search engines must never list a test copy of the salon's site, and you should always know which environment you're in. |
| 0.3 | **Email allowlist.** With `EMAIL_ALLOWLIST` set (comma-separated addresses or `@domain` entries), email goes only to listed addresses. Others are marked "not sent (staging)" instead of being sent. | Staging can never email a real person, even by mistake. |
| 0.4 | **Verified database SSL.** `DATABASE_CA_CERT` (Supabase's CA certificate, pasted as text) makes the connection check Supabase's certificate. Without it, the connection is encrypted but not verified. | The `pg` driver treats `sslmode=require` as full verification, and Supabase's certificate isn't in Node's default trust list, so this avoids the "self-signed certificate" error the safe way. |
| 0.5 | **`netlify.toml`:** build command, Node 22, and the security headers check. | Repeatable builds, so production later uses the same file. |
| 0.6 | **`.env.example` updated** with the new variables: `TRUSTED_PROXY`, `SITE_ENV`, `EMAIL_ALLOWLIST`, `DATABASE_CA_CERT`. | So the list of variables stays complete. |
| 0.7 | **Remote database scripts:** `npm run remote:migrate` and `npm run remote:admin` read a git-ignored `.env.remote.local` file. | Migrations and the first admin user run from your machine against staging (later production) without putting connection strings in your shell history. |

**Check:** `check.sh` passes on each commit, and the new tests pass: faked IP headers are ignored, staging sends `noindex`, and the allowlist blocks other addresses.


## Stage 1: Accounts and the repository (you)

1. **Turn on 2FA** for GitHub, Netlify, Supabase, Resend, cron-job.org and Paystack.
2. **Create a separate Netlify team** for this project, for example "Haircraft360 staging", and a **separate Supabase organisation**. Free limits are shared within a team or organisation, so this keeps your other projects and this one from using each other's allowance.
3. **Push the branch.** Netlify deploys from GitHub (`MasterLexhie/haircraft360-website`).
   - Staging deploys the **`staging`** branch, made from `launch-build`.
   - Production will deploy `main` later.
   - Tell me when to push, or push it yourself.

**Check:** the `staging` branch is visible on GitHub.


## Stage 2: Netlify site and region (you, then a decision)

The region decides where Supabase goes, and Supabase's region can't be changed later. So this comes first.

1. Netlify: **Add new project > Import from Git >** pick the repo, branch `staging`. Leave the build settings at what `netlify.toml` provides. **Don't add environment variables yet; the first build will fail without them, and that's fine.**
2. Go to **Project configuration > Build & deploy > Functions region** (the name may differ slightly) and check whether **London (`lhr`)** can be selected on the Free plan.
3. Pick the Supabase region from the answer:

| Netlify functions region | Supabase region | Why |
| - | - | - |
| London (`lhr`) available | **London (eu-west-2)** | Both near each other, and about 104 ms from Lagos |
| Stuck on Ohio (`cmh`, US East) | **Ohio (us-east-2)** | Every page makes several database calls. Ohio to London adds about 80 ms to *each* call, so the database must sit next to the functions. |

4. Note the site address (`https://<name>.netlify.app`). It's `NEXT_PUBLIC_SITE_URL` for staging.

**Check:** you know the functions region and have written down the Supabase region to use.


## Stage 3: Supabase (you, with commands from Claude)

1. **New project** in your staging organisation, in the region from Stage 2. Use a long generated database password and save it in your password manager.
2. **Project Settings > Data API:** turn the Data API **off**. The app never uses it, and turning it off closes a public route into the data.
3. **Database > Settings:** turn **Enforce SSL** on. Download the **CA certificate**; you'll paste it as `DATABASE_CA_CERT`.
4. **Connect > Connection strings.** Take two:
   - **Transaction pooler** (port **6543**) is `DATABASE_URL`, the app's connection.
   - **Session pooler** (port **5432**) is `DIRECT_URL`, for migrations. The direct connection is IPv6 only on the free plan, so the session pooler is the IPv4-safe choice.
5. **Run the migrations from your machine.** Create `.env.remote.local` (git-ignored) with just the two connection strings, `DATABASE_URL` and `DIRECT_URL`, then:
   ```bash
   npm run remote:migrate
   ```
   Claude can run this with you instead; it only needs that file.
6. **Confirm row level security and the timezone** in Supabase's SQL editor:
   ```sql
   select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1;
   show timezone;
   ```

**Check:** every table shows `relrowsecurity = true`, the timezone is `UTC`, and the migrations report "All migrations have been successfully applied".


## Stage 4: Resend (you)

Pick one:
- **A. No domain yet (simplest):** Resend's onboarding sender (`onboarding@resend.dev`) can only send to **your own account email**. That suits staging, combined with the allowlist.
- **B. A domain or subdomain you control,** for example `staging.yourdomain.com`: add the DNS records Resend shows (SPF, DKIM) and wait for "Verified". This lets the allowlist include more test addresses.

Then create an API key with **sending access only**.

**Check:** Resend shows the API key, and the domain is Verified if you chose B.


## Stage 5: Paystack test mode (you)

1. Paystack dashboard, **Test mode on**.
2. **Settings > API Keys & Webhooks:** copy the **test** secret key and public key.
3. Set the **Test Webhook URL** to:
   ```
   https://<name>.netlify.app/api/webhooks/paystack
   ```
4. Check **Settings > Preferences**: "pass fees to customers" must match `PAYSTACK_CUSTOMER_PAYS_FEES`.

The **Live** webhook URL stays empty on your account. Live mode belongs to the client's Paystack account later.

**Check:** the test webhook URL is saved.


## Stage 6: Environment variables on Netlify (you)

Netlify: **Project configuration > Environment variables.** Scope every variable to **Builds and Functions**. Mark the secret ones as secret.

Generate secrets on your machine:
```bash
openssl rand -base64 48
```
Use a **different** value for `AUTH_SECRET` and `CRON_SECRET`.

| Variable | Staging value |
| - | - |
| `DATABASE_URL` | Supabase transaction pooler string (port 6543) |
| `DIRECT_URL` | Supabase session pooler string (port 5432) |
| `DATABASE_CA_CERT` | Contents of Supabase's CA certificate file |
| `AUTH_SECRET` | Generated |
| `CRON_SECRET` | Generated |
| `PAYSTACK_SECRET_KEY` | Paystack **test** secret key (`sk_test_...`) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack **test** public key (`pk_test_...`) |
| `PAYSTACK_CUSTOMER_PAYS_FEES` | `true` or `false`, matching the dashboard |
| `EMAIL_TRANSPORT` | `resend` |
| `RESEND_API_KEY` | From Stage 4 |
| `EMAIL_FROM` | `Haircraft 360 Staging <onboarding@resend.dev>` (option A) or your verified sender (option B) |
| `OWNER_NOTIFICATION_EMAIL` | Your email |
| `EMAIL_ALLOWLIST` | Your email(s) |
| `NEXT_PUBLIC_SITE_URL` | `https://<name>.netlify.app` |
| `SALON_TIMEZONE` | `Africa/Lagos` |
| `DEVELOPER_CONTACT_WHATSAPP` | Your WhatsApp number, international format without + |
| `SITE_ENV` | `staging` |
| `TRUSTED_PROXY` | `netlify` |

Then **Deploys > Trigger deploy > Deploy project**.

**Check:** the deploy succeeds, the home page loads, and these respond:
```bash
curl -sI https://<name>.netlify.app/ | grep -i -E "x-robots-tag|strict-transport|content-security"
```
```bash
curl -s https://<name>.netlify.app/robots.txt
```
The first shows `noindex`, HSTS and the CSP. The second blocks everything.


## Stage 7: First admin and salon setup (you, with Claude)

1. **Create your admin** from your machine against staging, using the same `.env.remote.local` file. The script asks before touching a remote database:
   ```bash
   npm run remote:admin create you@example.com "Your name"
   ```
   It prints a password once. Save it in your password manager.
2. **Sign in** at `/admin/login`, set up 2FA on `/admin/account`, and save the backup codes.
3. **Through the admin, enter test salon data** in Settings:
   - services and add-ons, with clearly fake names, for example "Test retwist";
   - hours, deposit rule and messages;
   - salon details, with your test phone number;
   - a couple of Locs Mastery programs.

**Check:** the public pages show the test services and salon details, and the booking wizard shows free times.


## Stage 8: cron-job.org (you)

1. New cron job:
   - URL: `https://<name>.netlify.app/api/cron/notifications`
   - Method: **POST**
   - Schedule: **every hour**
2. Under **Advanced > Headers**, add `Authorization` with value `Bearer <CRON_SECRET>`.
3. Turn on **failure notifications** to your email.
4. Press **Test run**.

**Check:** the test run returns `ok sent=0` (or a number), and the admin dashboard no longer says "Reminders aren't running".


## Stage 9: End-to-end test (together)

Work through this list on staging and record each result in `docs/launch-checklist.md`. Use [Paystack's test cards](https://paystack.com/docs/payments/test-payments/) and the test bank transfer.

**Booking and payment**
- [ ] Book with add-ons at phone width: the summary, deposit and balance are right.
- [ ] Pay the deposit with a test card: the booking becomes Confirmed through the **webhook**. Check the Paystack dashboard's webhook log shows `200`.
- [ ] Pay with a test bank transfer: confirmed the same way.
- [ ] Close the payment window, then come back: the booking still confirms. This checks the backstop.
- [ ] A payment arriving after the hold expired, with the time now taken: the booking shows "Needs a new time" on the dashboard.
- [ ] The customer booking page opens from the email link and shows only that booking.
- [ ] Find my booking works, and is rate-limited after repeated tries.

**Messages**
- [ ] The confirmation email arrives (allowlisted address only), and the calendar file opens.
- [ ] An email to a non-allowlisted address shows "not sent (staging)".
- [ ] The cron run sends the reminder. Running the cron again sends nothing twice.
- [ ] A booking with "no email" appears in Reminders due, and the WhatsApp link opens with the message filled in.

**Admin**
- [ ] Login needs the password and the 2FA code. A backup code works once.
- [ ] The sixth wrong password is slowed down.
- [ ] Balance link payment, manual cash payment and a correction all record correctly.
- [ ] Complete a booking with an extra item, then mark a no-show.
- [ ] Add, edit and delete an expense. Finances totals match the payments.
- [ ] Locs Mastery application, then the owner email arrives, then mark it contacted.
- [ ] The dashboard's attention box, figures and balances look right.

**Security and setup**
- [ ] Response headers: CSP, HSTS, `noindex` on staging.
- [ ] A Supabase Data API request returns nothing, because it's turned off.
- [ ] A faked `cf-connecting-ip` header doesn't get around the login rate limit.
- [ ] Usage: note the Netlify credits and Supabase transfer used after the test week.

**Check:** every box ticked, or each failure written up and fixed.


## Running staging after launch

- **Credits:** each push to `staging` is a production deploy on your Netlify team, costing 15 of its 300 monthly credits. Push in batches. Staging never uses the client's credits.
- **Supabase pausing:** the hourly staging cron keeps the project awake. If it pauses anyway, unpause it in the dashboard.
- **Resetting test data:** cancel or complete test bookings through the admin. Don't wipe the database.


## Later: moving to the client's accounts (only on your go-ahead)

Same stages, with production values. What changes:

| Stage | Production difference |
| - | - |
| 0 | Nothing: the same code |
| 1 | The client's accounts, 2FA on each, you added as a member. Netlify deploys **`main`**. |
| 2 to 3 | The client's Netlify team and Supabase organisation, same region rule. Fresh migrations, no copied data. |
| 4 | The client's domain verified in Resend. `EMAIL_ALLOWLIST` **removed**. |
| 5 | The **client's** Paystack account in **live** mode (business verification done), Live Webhook URL set to the production domain. |
| 6 | `SITE_ENV` **removed**, `NEXT_PUBLIC_SITE_URL` set to the real domain, new secrets (never reuse staging's). |
| 7 | The client's own admin user. The client enters the real services and details. |
| 8 | The client's cron-job.org job. |
| 9 | A short live check: one real small payment, then cancel or refund it. |

Start the client's Paystack business verification and the domain early. Both take days.
