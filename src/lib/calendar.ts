/**
 * Calendar entries for a booking (BUILD_SPEC 6.4): an .ics file and a pre-filled Google
 * Calendar link. Times are written in UTC. The UID is fixed per booking and SEQUENCE rises
 * with every change, so a moved booking updates the entry instead of adding a second one.
 */

export interface CalendarEvent {
  /** Fixed per booking, for example `<booking id>@haircraft360.ng`. */
  uid: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  description: string;
  url?: string;
  /** Rises with every change to the booking. */
  sequence: number;
}

/** 20261121T090000Z */
function utcStamp(at: string | number | Date): string {
  return new Date(at).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** RFC 5545 text: backslash, semicolon, comma and newlines are escaped. */
function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets continue on the next line, which starts with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(event: CalendarEvent, nowMs = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Haircraft360//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${utcStamp(nowMs)}`,
    `DTSTART:${utcStamp(event.startAt)}`,
    `DTEND:${utcStamp(event.endAt)}`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText(event.location)}`,
    `DESCRIPTION:${icsText(event.description)}`,
    ...(event.url ? [`URL:${event.url}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(event.title)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Google Calendar's "add event" page, pre-filled. Works well on Android and in in-app browsers. */
export function googleCalendarUrl(event: Omit<CalendarEvent, "uid" | "sequence">): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(event.startAt)}/${utcStamp(event.endAt)}`,
    details: event.url ? `${event.description}\n\n${event.url}` : event.description,
    location: event.location,
    ctz: "Africa/Lagos",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
