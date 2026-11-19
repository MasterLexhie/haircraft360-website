import { BookingError } from "@/server/booking-service";
import { startMockCheckout } from "@/server/payments/mock";
import { clientIpFrom, hit, LIMITS, retryMessage } from "@/server/rate-limit";
import { badRequest, readJson, referenceParam, startCheckoutSchema } from "@/domain/schemas";

/** POST /api/bookings/:reference/checkout { token, purpose }: open a payment for the deposit or the balance. */
export async function POST(request: Request, ctx: { params: Promise<{ reference: string }> }) {
  const limit = await hit(`payment-init:ip:${clientIpFrom(request.headers)}`, LIMITS.paymentInitPerIp);
  if (!limit.ok) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: `Too many payment attempts. ${retryMessage(limit.retryAfterSeconds)}` } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const reference = referenceParam.safeParse((await ctx.params).reference);
  const body = startCheckoutSchema.safeParse(await readJson(request));
  if (!reference.success || !body.success) return badRequest();
  try {
    const result = await startMockCheckout(reference.data, body.data.token, body.data.purpose === "balance" ? "balance_online" : "deposit");
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return Response.json({ error: { code: err.code, message: err.message } }, { status: err.code === "NOT_FOUND" ? 404 : 409 });
    }
    throw err;
  }
}
