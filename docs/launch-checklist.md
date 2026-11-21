# Launch checklist: staging test results

Results of Stage 9 in `docs/DEPLOY_STAGING.md`, run on https://haircraft360.netlify.app (staging, the developer's accounts, Paystack test mode). Each line says what was checked, when, and what was seen.

## Setup checks (21 Nov 2026)

- [x] **Database:** 9 migrations applied; row level security on for all 24 tables; timezone UTC; the connection checks Supabase's certificate (TLS 1.3).
- [x] **Starting settings:** the first page load created the Settings row and logged it.
- [x] **Response headers:** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, and `noindex, nofollow` on staging. `robots.txt` blocks everything.
- [x] **Visitor IP:** rate limits read Netlify's header (a real IP, not the shared "local" bucket).
- [x] **Reminder endpoint:** refuses calls without the secret (401); cron-job.org's test run answered 200 and the dashboard stopped showing "Reminders aren't running".
- [x] **Admin:** your account with 2FA; every admin page loads with no console errors.
- [x] **Test data entered through the admin:** three services (Test wash offered with Test retwist), three expense categories, one Locs Mastery program with a ₦150,000 fee.
- [x] **Powered by Netlify badge:** turned off (it covered the phone's Book button).

## Booking and payment

- [x] **Card deposit confirms through the webhook** (21 Nov, HC-ERYXW): Test consultation, ₦5,000. Deposit ₦1,500 plus ₦22.85 Paystack charge, recorded separately. `charge.success` arrived 23 seconds after booking, signature valid, from a published Paystack address, processed with no error. Booking confirmed and the hold cleared.
- [ ] Book with add-ons at phone width: summary, deposit and balance right.
- [ ] Test bank transfer confirms the same way.
- [ ] Close the payment window, then come back: the booking still confirms.
- [ ] Payment after the hold expired, with the time taken: "Needs a new time" on the dashboard.
- [ ] The customer booking page opens from the email link and shows only that booking.
- [ ] Find my booking works and is rate-limited after repeated tries.

## Messages

- [x] **Confirmation email sent** (21 Nov, HC-ERYXW): sent by the cron test run at 7:29 pm Lagos time, accepted by Resend. The booking page shows "Confirmation sent by email" and "Reminder goes out by email Tue, 24 Nov, 10:00 am".
- [ ] The email arrives in the inbox and the calendar file opens.
- [ ] An email to a non-allowlisted address shows "not sent: staging copy".
- [ ] The cron run sends the reminder; running it again sends nothing twice.
- [ ] A "no email" booking appears in Reminders due, and the WhatsApp link opens with the message filled in.

## Admin

- [ ] Login needs the password and the 2FA code; a backup code works once.
- [ ] The sixth wrong password is slowed down.
- [ ] Balance link payment, manual cash payment and a correction all record correctly.
- [ ] Complete a booking with an extra item, then mark a no-show.
- [ ] Add, edit and delete an expense; Finances totals match the payments.
- [ ] Locs Mastery application, then the owner email arrives, then mark it contacted.
- [ ] The dashboard's attention box, figures and balances look right.

## Security and usage

- [ ] A Supabase Data API request returns nothing.
- [ ] A faked `cf-connecting-ip` header doesn't get around the login rate limit.
- [ ] Netlify credits and Supabase transfer used after the test week.
