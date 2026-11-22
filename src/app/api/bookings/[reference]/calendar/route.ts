import { cookies } from "next/headers";
import { getCustomerBooking, getSalon } from "@/server/queries";
import { bookingCookieName } from "@/lib/booking-cookie";
import { calendarEventFor } from "@/server/booking-calendar";
import { bookingUrl } from "@/server/booking-access";
import { balanceDue } from "@/domain/pricing";
import { referenceParam } from "@/domain/schemas";
import { buildIcs } from "@/lib/calendar";

/**
 * GET /api/bookings/:reference/calendar: the booking as an .ics file (BUILD_SPEC 6.4).
 * Opens with the booking page's cookie, or ?t=<token> for the link in emails, which calendar
 * apps may open outside the browser. Served inline, so iPhones offer "Add to Calendar".
 */
export async function GET(request: Request, ctx: { params: Promise<{ reference: string }> }) {
  const reference = referenceParam.safeParse((await ctx.params).reference);
  const raw = (await ctx.params).reference;
  const token = new URL(request.url).searchParams.get("t") ?? (await cookies()).get(bookingCookieName(raw))?.value;
  const data = reference.success ? await getCustomerBooking(reference.data, token) : null;
  if (!data || (data.booking.status !== "confirmed" && data.booking.status !== "completed")) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const { booking, payments } = data;
  const event = calendarEventFor(booking, await getSalon(), { url: bookingUrl(booking.reference, token!), balanceKobo: balanceDue(booking, payments) });
  return new Response(buildIcs(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${booking.reference}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
