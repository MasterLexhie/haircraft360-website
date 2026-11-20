import { settlePayment } from "@/server/payments/checkout";
import { paymentErrorResponse } from "@/server/payments/http";
import { clientIpFrom, hit, LIMITS, retryMessage } from "@/server/rate-limit";
import { attemptReferenceParam } from "@/domain/schemas";

/**
 * POST /api/payments/:reference/verify: asks Paystack how the payment ended and records it.
 * The browser calls this when the popup reports success, so the booking confirms even if
 * the webhook is late. Recording is idempotent and trusts only Paystack's answer.
 */
export async function POST(request: Request, ctx: { params: Promise<{ reference: string }> }) {
  const limit = await hit(`payment-verify:ip:${clientIpFrom(request.headers)}`, LIMITS.paymentVerifyPerIp);
  if (!limit.ok) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: `Too many checks. ${retryMessage(limit.retryAfterSeconds)}` } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const reference = attemptReferenceParam.safeParse((await ctx.params).reference);
  if (!reference.success) return Response.json({ outcome: "unknown" }, { status: 404 });
  try {
    return Response.json({ outcome: await settlePayment(reference.data, "Paystack") });
  } catch (err) {
    return paymentErrorResponse(err);
  }
}
