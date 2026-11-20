import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailSendError, sendEmail, type EmailMessage } from "@/server/email/transport";
import { confirmationEmail, dailySummaryEmail, escapeHtml, type BookingEmailData } from "@/server/email/templates";
import { fillTemplate } from "@/domain/messages";

const msg: EmailMessage = {
  to: "ada@example.com",
  subject: "Booking confirmed",
  html: "<p>Hi</p>",
  text: "Hi",
  attachments: [{ filename: "HC-ABCDE.ics", content: "BEGIN:VCALENDAR\r\n₦\r\n", contentType: "text/calendar" }],
};

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("email transport", () => {
  it("sends through Resend with the notification ID as the idempotency key", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Haircraft 360 <bookings@example.test>");
    const fetch = stubFetch(200, { id: "msg_1" });
    expect(await sendEmail(msg, "ntf_123")).toEqual({ id: "msg_1" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const headers = new Headers(init!.headers);
    expect(headers.get("idempotency-key")).toBe("ntf_123");
    expect(headers.get("authorization")).toBe("Bearer re_test");
    const body = JSON.parse(String(init!.body));
    expect(body).toMatchObject({ from: "Haircraft 360 <bookings@example.test>", to: ["ada@example.com"], subject: "Booking confirmed" });
    expect(atob(body.attachments[0].content)).toContain("BEGIN:VCALENDAR");
  });

  it.each([
    [429, { name: "daily_quota_exceeded" }, "daily_limit"],
    [429, { name: "monthly_quota_exceeded" }, "daily_limit"],
    [429, { name: "rate_limit_exceeded" }, "rate_limited"],
    [503, { name: "service_unavailable" }, "temporary"],
    [422, { name: "invalid_parameter" }, "permanent"],
    [403, { name: "validation_error" }, "permanent"],
  ])("sorts Resend %s %o as %s", async (status, body, kind) => {
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "bookings@example.test");
    stubFetch(status, body);
    await expect(sendEmail(msg, "ntf_1")).rejects.toMatchObject({ kind });
  });

  it("treats a network failure as temporary", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "bookings@example.test");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(sendEmail(msg, "ntf_1")).rejects.toMatchObject({ kind: "temporary" });
  });

  it("posts to Mailpit's send API with the attachment in base64", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "mailpit");
    vi.stubEnv("EMAIL_FROM", "Haircraft 360 <bookings@example.test>");
    const fetch = stubFetch(200, { ID: "mp_1" });
    expect(await sendEmail(msg, "ntf_1")).toEqual({ id: "mp_1" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:8025/api/v1/send");
    const body = JSON.parse(String(init!.body));
    expect(body.From).toEqual({ Email: "bookings@example.test", Name: "Haircraft 360" });
    expect(body.To).toEqual([{ Email: "ada@example.com" }]);
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(body.Attachments[0].Content), (c) => c.charCodeAt(0)));
    expect(decoded).toBe("BEGIN:VCALENDAR\r\n₦\r\n");
  });

  it("prints to the console, and refuses an unknown transport", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "console");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await sendEmail(msg, "ntf_9")).toEqual({ id: "console-ntf_9" });
    expect(log.mock.calls[0]![0]).toContain("ada@example.com");
    log.mockRestore();
    vi.stubEnv("EMAIL_TRANSPORT", "pigeon");
    await expect(sendEmail(msg, "ntf_1")).rejects.toBeInstanceOf(EmailSendError);
  });
});

const data: BookingEmailData = {
  salon: { name: "Haircraft360", address: "N5, 64B Basorun Road, Ibadan", mapsUrl: "https://maps.example/x", phoneDisplay: "0805 845 5564" },
  intro: "Thank you for booking with Haircraft360.",
  customerName: "<script>alert(1)</script> Ada",
  reference: "HC-ABCDE",
  startAt: "2026-11-21T09:00:00.000Z",
  durationMinutes: 120,
  items: [
    { name: "Loc retwist", priceKobo: 1_500_000, kind: "main" },
    { name: "Wash & style", priceKobo: 300_000, kind: "add_on" },
  ],
  totalKobo: 1_800_000,
  paidKobo: 540_000,
  balanceKobo: 1_260_000,
  bookingUrl: "https://haircraft360.ng/booking/HC-ABCDE?t=abc&x=1",
  icsUrl: "https://haircraft360.ng/api/bookings/HC-ABCDE/calendar?t=abc",
  googleCalendarUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE",
};

describe("email templates", () => {
  it("escapes what people typed, everywhere it appears", () => {
    const e = confirmationEmail(data);
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; Ada");
    expect(e.html).toContain("Wash &amp; style");
    expect(e.html).toContain('href="https://haircraft360.ng/booking/HC-ABCDE?t=abc&amp;x=1"');
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;");
  });

  it("gives the date and time in Lagos, the money, and the links, in HTML and text", () => {
    const e = confirmationEmail(data);
    expect(e.subject).toBe("Booking confirmed: Saturday, 21 November 2026 at 10:00 am");
    for (const part of [e.html, e.text]) {
      expect(part).toContain("₦12,600");
      expect(part).toContain("HC-ABCDE");
    }
    expect(e.text).toContain("View your booking: https://haircraft360.ng/booking/HC-ABCDE?t=abc&x=1");
    expect(e.text).toContain("Add to calendar: https://haircraft360.ng/api/bookings/HC-ABCDE/calendar?t=abc");
  });

  it("summarises the day for the owner, including empty days", () => {
    const e = dailySummaryEmail({ salon: data.salon, dateLabel: "Saturday, 21 November", today: [], newBookings: [], attention: [], adminUrl: "https://x/admin" });
    expect(e.subject).toBe("Today at Haircraft360: 0 appointments");
    expect(e.text).toContain("Nothing");
    expect(e.html).toContain("No appointments today.");
  });
});

describe("message templates", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fillTemplate("Hello {name}, see you {date} at {time}. {oops}", { name: "Ada", date: "Saturday", time: "10:00 am" })).toBe(
      "Hello Ada, see you Saturday at 10:00 am. {oops}",
    );
  });
});
