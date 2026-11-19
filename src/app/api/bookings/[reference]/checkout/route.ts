import { BookingError } from "@/server/booking-service";
import { startMockCheckout } from "@/server/payments/mock";
import { clientIpFrom, hit, LIMITS, retryMessage } from "@/server/rate-limit";

/** POST /api/bookings/:reference/checkout { token, purpose }: open a payment for the deposit or the balance. */
export async function POST(request: Request, ctx: { params: Promise<{ reference: string }> }) {
  const limit = await hit(`payment-init:ip:${clientIpFrom(request.headers)}`, LIMITS.paymentInitPerIp);
  if (!limit.ok) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: `Too many payment attempts. ${retryMessage(limit.retryAfterSeconds)}` } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const { reference } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { token?: string; purpose?: string };
  const purpose = body.purpose === "balance" ? "balance_online" : "deposit";
  try {
    const result = await startMockCheckout(reference, String(body.token ?? ""), purpose);
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return Response.json({ error: { code: err.code, message: err.message } }, { status: err.code === "NOT_FOUND" ? 404 : 409 });
    }
    throw err;
  }
}
