import { startLinkPayment } from "@/server/payments/links";
import { paymentErrorResponse } from "@/server/payments/http";
import { clientIpFrom, hit, LIMITS, retryMessage } from "@/server/rate-limit";
import { badRequest, payLinkSchema, readJson } from "@/domain/schemas";

/** POST /api/pay { token }: a fresh Paystack transaction for the balance on a payment link. */
export async function POST(request: Request) {
  const limit = await hit(`payment-init:ip:${clientIpFrom(request.headers)}`, LIMITS.paymentInitPerIp);
  if (!limit.ok) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: `Too many payment attempts. ${retryMessage(limit.retryAfterSeconds)}` } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const body = payLinkSchema.safeParse(await readJson(request));
  if (!body.success) return badRequest();
  try {
    return Response.json(await startLinkPayment(body.data.token), { status: 201 });
  } catch (err) {
    return paymentErrorResponse(err);
  }
}
