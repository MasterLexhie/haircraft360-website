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

- [x] **Booking form after a booking** (21 Nov): starts empty at step 1, with no stuck "Confirming payment" button; a refresh always gives an empty form. Checked in Chromium and Firefox; Safari still to recheck on a phone.

- [x] **Card deposit confirms through the webhook** (21 Nov, HC-ERYXW): Test consultation, ₦5,000. Deposit ₦1,500 plus ₦22.85 Paystack charge, recorded separately. `charge.success` arrived 23 seconds after booking, signature valid, from a published Paystack address, processed with no error. Booking confirmed and the hold cleared.
- [x] **Booking with an add-on** (21 Nov, HC-TCVQD): Test retwist + Test wash, review showed ₦18,000 total, ₦5,400 deposit, ₦12,600 balance; paid in Paystack test mode and confirmed. (Desktop width; phone width still to check.)
- [x] **Bank transfer** (local, HC-2J87E, Paystack test mode): sent via "I've sent the money"; Paystack was still waiting when the window was closed, the app checked again on close and confirmed. Recorded as transfer, ₦2,000 plus ₦30.46 charge kept separate; confirmation email sent.
- [x] **Window closed** (local): after a transfer, closing triggers a final check that confirms the booking (HC-2J87E). Closing without paying leaves the booking "Awaiting deposit" with a Pay deposit button (HC-AXP86). Tested locally because staging payments need someone to press Paystack's test buttons; the code is the same.
- [ ] Payment after the hold expired, with the time taken: "Needs a new time" on the dashboard.
- [x] **Customer booking link** (21 Nov, HC-BRPE5, link taken from the WhatsApp message): shows only that booking; a wrong token shows "We couldn't open that booking" and nothing else.
- [x] **Find my booking** (HC-DUNSQ + phone): shows only date, time, status and balance. Wrong lookups are refused with "Too many lookups" after the limit (10 per 15 minutes).

## Messages

- [x] **Confirmation sent within a second of payment** (21 Nov, HC-TCVQD): confirmed 8:03:46 pm, email sent 8:03:46 pm, with no cron run. Before the fix, confirmations waited for the hourly run (HC-RWTUE waited 10 minutes, then went with the 8:00 pm run).
- [x] **Reminder scheduled a day before:** HC-TCVQD (Mon 23 Nov, 4:30 pm) has its reminder due Sun 22 Nov, 4:30 pm.

- [x] **Confirmation email sent** (21 Nov, HC-ERYXW): sent by the cron test run at 7:29 pm Lagos time, accepted by Resend. The booking page shows "Confirmation sent by email" and "Reminder goes out by email Tue, 24 Nov, 10:00 am".
- [ ] The email arrives in the inbox and the calendar file opens.
- [x] **Allowlist** (HC-BRPE5, cash deposit): "Confirmation not sent: staging copy, address not on the email allowlist".
- [ ] The cron run sends the reminder (first one due Sun 22 Nov). Running the cron twice in a row sent nothing twice (checked 21 Nov).
- [x] **No-email booking** (HC-DUNSQ, cash deposit): appears in Reminders due with the filled WhatsApp message; Mark as sent clears it and the booking shows "Confirmation sent on WhatsApp".

## Admin

- [ ] Login needs the password and the 2FA code; a backup code works once.
- [x] **Login rate limit** (local): five wrong passwords refused normally; the 6th and 7th were blocked with "Too many sign-in attempts. Please try again in 8 minutes".
- [x] **Money actions** (HC-BRPE5): payment link page shows ₦3,500 balance plus fee; cash balance ₦2,000 recorded; a correction without a reason is blocked; −₦500 correction with a reason recorded. Paid ₦3,000, balance ₦2,000. (Paying the link itself not tested.)
- [x] **Complete and no-show** (local, past seed bookings; staging has no started appointment until Monday): HC-SD038 completed with a ₦2,500 item added on the day, total ₦53,000 to ₦55,500, balance ₦39,600. HC-SD037 marked no-show after the confirmation prompt; its ₦2,000 deposit kept.
- [x] **Expenses and Finances:** added ₦2,500, edited to ₦3,000, deleted after a confirmation. Finances matched the database (revenue ₦16,800, expenses ₦3,000 then ₦0).
- [x] **Locs Mastery application** (LM-NU4Z7E): applicant receipt and owner alert sent within a second; dashboard showed it; marked contacted and logged.
- [x] **Dashboard:** attention box, next 7 days (5), popular services and new customers all add up.

## Security and usage

- [x] **Supabase Data API** (21 Nov, with the project's public key): reads of bookings, customers, payments, admin_users and settings, and an insert into expenses, all refused (503, PGRST002). No data returned. Row level security is also on for every table.
- [x] **Faked IP headers:** three requests with different made-up IPs were all counted against the one real IP.
- [ ] Netlify credits and Supabase transfer used after the test week.
