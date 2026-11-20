import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar";

const event: CalendarEvent = {
  uid: "bk_123@haircraft360.ng",
  title: "Loc retwist at Haircraft360",
  // 10:00 in Lagos (UTC+1)
  startAt: "2026-11-21T09:00:00.000Z",
  endAt: "2026-11-21T11:00:00.000Z",
  location: "N5, 64B Basorun Road, Ibadan",
  description: "Booking HC-ABCDE: Loc retwist; wash.\nBalance due at the salon: ₦3,000.",
  url: "https://haircraft360.ng/booking/HC-ABCDE?t=abc",
  sequence: 1795180000,
};

describe("calendar file", () => {
  const ics = buildIcs(event, Date.parse("2026-11-20T12:00:00Z"));

  it("writes times in UTC with a fixed UID and a sequence", () => {
    expect(ics).toContain("DTSTART:20261121T090000Z\r\n");
    expect(ics).toContain("DTEND:20261121T110000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261120T120000Z\r\n");
    expect(ics).toContain("UID:bk_123@haircraft360.ng\r\n");
    expect(ics).toContain("SEQUENCE:1795180000\r\n");
  });

  it("escapes commas, semicolons and newlines, and uses CRLF line endings", () => {
    expect(ics).toContain("LOCATION:N5\\, 64B Basorun Road\\, Ibadan");
    expect(ics).toContain("Loc retwist\\; wash.\\nBalance");
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("folds long lines at 75 bytes without splitting a character", () => {
    const lines = ics.split("\r\n");
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("Balance due at the salon: ₦3\\,000.");
  });
});

describe("Google Calendar link", () => {
  it("pre-fills the event in UTC", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261121T090000Z/20261121T110000Z");
    expect(url.searchParams.get("text")).toBe(event.title);
    expect(url.searchParams.get("details")).toContain(event.url);
  });
});
