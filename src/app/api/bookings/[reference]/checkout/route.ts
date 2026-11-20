import { startBookingPayment } from "@/server/payments/checkout";
import { paymentErrorResponse } from "@/server/payments/http";
import { clientIpFrom, hit, LIMITS, retryMessage } from "@/server/rate-limit";
import { badRequest, readJson, referenceParam, startCheckoutSchema } from "@/domain/schemas";

/** POST /api/bookings/:reference/checkout { token, purpose }: a fresh Paystack transaction for the deposit or the balance. */
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
    return Response.json(await startBookingPayment(reference.data, body.data.token, body.data.purpose === "balance" ? "balance_online" : "deposit"), { status: 201 });
  } catch (err) {
    return paymentErrorResponse(err);
  }
}
