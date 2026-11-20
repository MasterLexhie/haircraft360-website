import { attemptOutcome } from "@/server/payments/checkout";
import { attemptReferenceParam } from "@/domain/schemas";

/**
 * GET /api/payments/:reference: paid, pending, failed or unknown, from our own records.
 * Polled by the browser while a payment is confirming. Reveals nothing about the booking.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ reference: string }> }) {
  const reference = attemptReferenceParam.safeParse((await ctx.params).reference);
  if (!reference.success) return Response.json({ outcome: "unknown" }, { status: 404 });
  return Response.json({ outcome: await attemptOutcome(reference.data) }, { headers: { "Cache-Control": "no-store" } });
}
