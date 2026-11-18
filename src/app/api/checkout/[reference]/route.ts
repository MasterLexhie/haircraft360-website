import { BookingError } from "@/server/booking-service";
import { completeMockCheckout } from "@/server/payments/mock";

/**
 * POST /api/checkout/:reference { token, outcome: "success" | "failed" }
 * DEVELOPMENT ONLY (ENABLE_MOCK_CHECKOUT). Removed when the Paystack webhook lands (Milestone 4).
 * Requires the booking's link token. Idempotent: repeating it never adds a second payment.
 */
export async function POST(request: Request, ctx: { params: Promise<{ reference: string }> }) {
  const { reference } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { outcome?: string; token?: string };
  if (body.outcome !== "success" && body.outcome !== "failed") {
    return Response.json({ error: { code: "VALIDATION", message: "Outcome must be success or failed." } }, { status: 400 });
  }
  try {
    return Response.json(await completeMockCheckout(reference, String(body.token ?? ""), body.outcome));
  } catch (err) {
    if (err instanceof BookingError) {
      return Response.json({ error: { code: err.code, message: err.message } }, { status: err.code === "NOT_FOUND" ? 404 : 409 });
    }
    throw err;
  }
}
