import type { NextRequest } from "next/server";
import { dateOptions, slotsForDate } from "@/domain/availability";
import { isValidDateKey } from "@/lib/time";
import { availabilityQuerySchema, badRequest } from "@/domain/schemas";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";

/**
 * GET /api/availability?duration=150&date=2026-11-12
 * The date strip (with available-slot counts) and, when `date` is given, that day's free slots.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = availabilityQuerySchema.safeParse({ duration: params.get("duration"), date: params.get("date") });
  if (!parsed.success || (parsed.data.date && !isValidDateKey(parsed.data.date))) return badRequest("Invalid duration or date.");
  const { duration } = parsed.data;
  const date = parsed.data.date ?? null;
  const nowMs = Date.now();
  const settings = await loadSettings();
  const horizonEnd = new Date(nowMs + (settings.availability.bookingHorizonDays + 2) * 86_400_000);
  const rows = await db.booking.findMany({
    where: { status: { in: ["confirmed", "completed", "pending_payment"] }, endAt: { gt: new Date(nowMs - 86_400_000) }, startAt: { lt: horizonEnd } },
    select: { id: true, status: true, startAt: true, endAt: true, holdExpiresAt: true },
  });
  const bookings = rows.map((r) => ({ id: r.id, status: r.status, startAt: r.startAt.toISOString(), endAt: r.endAt.toISOString(), holdExpiresAt: r.holdExpiresAt?.toISOString() ?? null }));
  const base = { durationMinutes: duration, config: settings.availability, bookings, nowMs };
  const dates = dateOptions(base);
  const day = date ? slotsForDate({ ...base, dateKey: date }) : null;
  return Response.json(
    { dates, date, status: day?.status ?? null, slots: day?.slots.filter((s) => s.available) ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
