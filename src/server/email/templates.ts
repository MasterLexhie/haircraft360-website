import { formatNaira } from "@/lib/money";
import { formatLongDate, formatTime } from "@/lib/time";

/**
 * Email content (BUILD_SPEC 6.4). Plain functions: data in, subject, HTML and text out.
 * Every value that a person typed is escaped. Styles are inline, which is what email
 * clients understand. Wording stays free of the payment provider's name.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface SalonInfo {
  name: string;
  address: string;
  mapsUrl: string;
  phoneDisplay: string;
}

export interface BookingEmailData {
  salon: SalonInfo;
  /** The owner's intro from Settings, placeholders already filled. */
  intro: string;
  customerName: string;
  reference: string;
  startAt: string;
  durationMinutes: number;
  items: { name: string; priceKobo: number; kind: "main" | "add_on" | "extra" }[];
  totalKobo: number;
  paidKobo: number;
  balanceKobo: number;
  bookingUrl: string;
  icsUrl: string;
  googleCalendarUrl: string;
}

const C = { ink: "#2b2029", ink2: "#4e404c", ink3: "#6f5f6c", line: "#ecdfe5", accent: "#513650", soft: "#f3e8ee", bg: "#fdfafc" };

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function button(href: string, label: string, primary = false): string {
  const style = primary
    ? `background:${C.accent};color:#ffffff;border:1px solid ${C.accent};`
    : `background:#ffffff;color:${C.accent};border:1px solid ${C.accent};`;
  return `<a href="${escapeHtml(href)}" style="${style}display:inline-block;padding:11px 18px;border-radius:6px;font-weight:600;font-size:14px;text-decoration:none;margin:0 8px 8px 0;">${escapeHtml(label)}</a>`;
}

function row(label: string, value: string, strong = false): string {
  const w = strong ? "font-weight:600;color:" + C.ink : "color:" + C.ink2;
  return `<tr><td style="padding:6px 0;${w}">${escapeHtml(label)}</td><td style="padding:6px 0;text-align:right;${w}">${escapeHtml(value)}</td></tr>`;
}

function layout(salon: SalonInfo, title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${C.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line};border-radius:10px;">
<tr><td style="padding:22px 24px;border-bottom:1px solid ${C.line};font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.accent};">${escapeHtml(salon.name)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55;">${body}</td></tr>
<tr><td style="padding:18px 24px;border-top:1px solid ${C.line};font-size:13px;line-height:1.5;color:${C.ink3};">${escapeHtml(salon.name)} · ${escapeHtml(salon.address)}<br>Questions? Call ${escapeHtml(salon.phoneDisplay)}.</td></tr>
</table></td></tr></table></body></html>`;
}

function itemLines(items: BookingEmailData["items"]): { html: string; text: string } {
  return {
    html: items.map((i) => row(`${i.kind === "add_on" ? "+ " : ""}${i.name}`, formatNaira(i.priceKobo))).join(""),
    text: items.map((i) => `  ${i.kind === "add_on" ? "+ " : ""}${i.name}: ${formatNaira(i.priceKobo)}`).join("\n"),
  };
}

function bookingBody(d: BookingEmailData, heading: string): { html: string; text: string } {
  const when = `${formatLongDate(d.startAt)} at ${formatTime(d.startAt)}`;
  const items = itemLines(d.items);
  const html = `
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:${C.ink};">${escapeHtml(heading)}</h1>
<p style="margin:0 0 18px;color:${C.ink2};">Hello ${escapeHtml(d.customerName)}, ${escapeHtml(d.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-radius:8px;"><tr><td style="padding:14px 16px;">
<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.ink3};">Booking ${escapeHtml(d.reference)}</div>
<div style="font-size:17px;font-weight:600;margin-top:4px;">${escapeHtml(when)}</div>
<div style="color:${C.ink2};">About ${d.durationMinutes} minutes · Ibadan time</div>
<div style="color:${C.ink2};margin-top:6px;"><a href="${escapeHtml(d.salon.mapsUrl)}" style="color:${C.accent};">${escapeHtml(d.salon.address)}</a></div>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid ${C.line};">
${items.html}
<tr><td colspan="2" style="border-top:1px solid ${C.line};"></td></tr>
${row("Total", formatNaira(d.totalKobo))}
${row("Paid so far", formatNaira(d.paidKobo))}
${row("Balance due at the salon", formatNaira(d.balanceKobo), true)}
</table>
<div style="margin-top:22px;">${button(d.bookingUrl, "View your booking", true)}${button(d.icsUrl, "Add to calendar")}${button(d.googleCalendarUrl, "Google Calendar")}</div>
<p style="margin:14px 0 0;font-size:13px;color:${C.ink3};">Need to change something? Call the salon on ${escapeHtml(d.salon.phoneDisplay)}.</p>`;
  const text = [
    heading,
    "",
    `Hello ${d.customerName}, ${d.intro}`,
    "",
    `Booking ${d.reference}`,
    when,
    `About ${d.durationMinutes} minutes, Ibadan time`,
    d.salon.address,
    "",
    items.text,
    `Total: ${formatNaira(d.totalKobo)}`,
    `Paid so far: ${formatNaira(d.paidKobo)}`,
    `Balance due at the salon: ${formatNaira(d.balanceKobo)}`,
    "",
    `View your booking: ${d.bookingUrl}`,
    `Add to calendar: ${d.icsUrl}`,
    `Google Calendar: ${d.googleCalendarUrl}`,
    "",
    `Need to change something? Call the salon on ${d.salon.phoneDisplay}.`,
  ].join("\n");
  return { html, text };
}

export function confirmationEmail(d: BookingEmailData): RenderedEmail {
  const body = bookingBody(d, "Your appointment is confirmed");
  return { subject: `Booking confirmed: ${formatLongDate(d.startAt)} at ${formatTime(d.startAt)}`, html: layout(d.salon, "Booking confirmed", body.html), text: body.text };
}

export function reminderEmail(d: BookingEmailData): RenderedEmail {
  const body = bookingBody(d, "See you tomorrow");
  return { subject: `Reminder: your appointment tomorrow at ${formatTime(d.startAt)}`, html: layout(d.salon, "Appointment reminder", body.html), text: body.text };
}

export interface DailySummaryData {
  salon: SalonInfo;
  dateLabel: string;
  today: { time: string; name: string; services: string; balanceKobo: number }[];
  newBookings: { when: string; name: string; services: string }[];
  /** Plain-language lines for anything waiting on the owner. */
  attention: string[];
  adminUrl: string;
}

export function dailySummaryEmail(d: DailySummaryData): RenderedEmail {
  const todayHtml = d.today.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.today
        .map(
          (b) =>
            `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};width:70px;font-weight:600;">${escapeHtml(b.time)}</td><td style="padding:7px 0;border-bottom:1px solid ${C.line};">${escapeHtml(b.name)}<br><span style="color:${C.ink3};font-size:13px;">${escapeHtml(b.services)}</span></td><td style="padding:7px 0;border-bottom:1px solid ${C.line};text-align:right;color:${C.ink2};font-size:13px;">${b.balanceKobo > 0 ? `${escapeHtml(formatNaira(b.balanceKobo))} due` : "Paid"}</td></tr>`,
        )
        .join("")}</table>`
    : `<p style="color:${C.ink3};margin:0;">No appointments today.</p>`;
  const newHtml = d.newBookings.length
    ? `<ul style="margin:0;padding-left:18px;color:${C.ink2};">${d.newBookings.map((b) => `<li style="margin:4px 0;">${escapeHtml(b.name)}: ${escapeHtml(b.services)}, ${escapeHtml(b.when)}</li>`).join("")}</ul>`
    : `<p style="color:${C.ink3};margin:0;">No new bookings since yesterday.</p>`;
  const attentionHtml = d.attention.length
    ? `<ul style="margin:0;padding-left:18px;color:${C.ink};">${d.attention.map((a) => `<li style="margin:4px 0;">${escapeHtml(a)}</li>`).join("")}</ul>`
    : `<p style="color:${C.ink3};margin:0;">Nothing needs your attention.</p>`;
  const h2 = (t: string) => `<h2 style="margin:22px 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${C.ink3};">${t}</h2>`;
  const html = layout(
    d.salon,
    "Daily summary",
    `<h1 style="margin:0 0 4px;font-size:22px;">Today at ${escapeHtml(d.salon.name)}</h1><p style="margin:0;color:${C.ink2};">${escapeHtml(d.dateLabel)}</p>
${h2(`Today's appointments (${d.today.length})`)}${todayHtml}
${h2(`New bookings (${d.newBookings.length})`)}${newHtml}
${h2("Needs your attention")}${attentionHtml}
<div style="margin-top:22px;">${button(d.adminUrl, "Open the dashboard", true)}</div>`,
  );
  const text = [
    `Today at ${d.salon.name}, ${d.dateLabel}`,
    "",
    `Today's appointments (${d.today.length}):`,
    ...(d.today.length ? d.today.map((b) => `  ${b.time}  ${b.name}: ${b.services}${b.balanceKobo > 0 ? ` (${formatNaira(b.balanceKobo)} due)` : ""}`) : ["  None"]),
    "",
    `New bookings (${d.newBookings.length}):`,
    ...(d.newBookings.length ? d.newBookings.map((b) => `  ${b.name}: ${b.services}, ${b.when}`) : ["  None"]),
    "",
    "Needs your attention:",
    ...(d.attention.length ? d.attention.map((a) => `  ${a}`) : ["  Nothing"]),
    "",
    `Dashboard: ${d.adminUrl}`,
  ].join("\n");
  return { subject: `Today at ${d.salon.name}: ${d.today.length} appointment${d.today.length === 1 ? "" : "s"}`, html, text };
}

export function ownerAlertEmail(salon: SalonInfo, message: string, adminUrl: string): RenderedEmail {
  return {
    subject: `Security notice: ${salon.name} admin`,
    html: layout(
      salon,
      "Security notice",
      `<h1 style="margin:0 0 10px;font-size:20px;">Security notice</h1><p style="margin:0 0 16px;color:${C.ink2};">${escapeHtml(message)}</p><p style="margin:0 0 18px;color:${C.ink2};">If this wasn't you, change your password straight away and contact your developer.</p>${button(adminUrl, "Open the admin", true)}`,
    ),
    text: `Security notice\n\n${message}\n\nIf this wasn't you, change your password straight away and contact your developer.\n\n${adminUrl}`,
  };
}
