import type { NextRequest } from "next/server";
import { dateOptions, slotsForDate } from "@/domain/availability";
import { isValidDateKey } from "@/lib/time";
import { readDb } from "@/server/store";

/**
 * GET /api/availability?duration=150&date=2026-11-12
 * Returns the date strip (with available-slot counts) and, when `date` is
 * given, that day's slots. Based on demo opening hours + existing bookings.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const duration = Number(params.get("duration"));
  const date = params.get("date");
  if (!Number.isInteger(duration) || duration < 15 || duration > 12 * 60) {
    return Response.json({ error: "Invalid duration." }, { status: 400 });
  }
  if (date && !isValidDateKey(date)) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }
  const db = readDb();
  const nowMs = Date.now();
  const base = { durationMinutes: duration, config: db.settings.availability, bookings: db.bookings, nowMs };
  const dates = dateOptions(base);
  const day = date ? slotsForDate({ ...base, dateKey: date }) : null;
  return Response.json(
    { dates, date, status: day?.status ?? null, slots: day?.slots.filter((s) => s.available) ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
