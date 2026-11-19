import { BookingError } from "@/server/booking-service";
import { completeMockCheckout } from "@/server/payments/mock";
import { badRequest, completeMockCheckoutSchema, readJson, referenceParam } from "@/domain/schemas";

/**
 * POST /api/checkout/:reference { token, outcome: "success" | "failed" }
 * DEVELOPMENT ONLY (ENABLE_MOCK_CHECKOUT). Removed when the Paystack webhook lands (Milestone 4).
 * Requires the booking's link token. Idempotent: repeating it never adds a second payment.
 */
export async function POST(request: Request, ctx: { params: Promise<{ reference: string }> }) {
  const reference = referenceParam.safeParse((await ctx.params).reference);
  const body = completeMockCheckoutSchema.safeParse(await readJson(request));
  if (!reference.success || !body.success) return badRequest();
  try {
    return Response.json(await completeMockCheckout(reference.data, body.data.token, body.data.outcome));
  } catch (err) {
    if (err instanceof BookingError) {
      return Response.json({ error: { code: err.code, message: err.message } }, { status: err.code === "NOT_FOUND" ? 404 : 409 });
    }
    throw err;
  }
}
