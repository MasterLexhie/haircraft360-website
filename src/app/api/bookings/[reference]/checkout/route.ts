import { BookingError, startCheckout } from "@/server/booking-service";

/** POST /api/bookings/:reference/checkout { token, purpose } — open a demo deposit/balance checkout. */
export async function POST(request: Request, ctx: { params: Promise<{ reference: string }> }) {
  const { reference } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { token?: string; purpose?: string };
  const purpose = body.purpose === "balance" ? "balance" : "deposit";
  try {
    const result = startCheckout(reference, String(body.token ?? ""), purpose);
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return Response.json({ error: { code: err.code, message: err.message } }, { status: err.code === "NOT_FOUND" ? 404 : 409 });
    }
    throw err;
  }
}
