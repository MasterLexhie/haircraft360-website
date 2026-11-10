import { BookingError, completeMockCheckout } from "@/server/booking-service";

/**
 * POST /api/checkout/:reference { outcome: "success" | "failed" }
 * MOCK ONLY: simulates the gateway result. In production this is replaced by a
 * signature-verified Paystack webhook + server-side transaction verification.
 * Idempotent — repeating the call never adds a second payment.
 */
export async function POST(request: Request, ctx: { params: Promise<{ reference: string }> }) {
  const { reference } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { outcome?: string };
  if (body.outcome !== "success" && body.outcome !== "failed") {
    return Response.json({ error: { code: "VALIDATION", message: "Outcome must be success or failed." } }, { status: 400 });
  }
  try {
    return Response.json(completeMockCheckout(reference, body.outcome));
  } catch (err) {
    if (err instanceof BookingError) {
      return Response.json({ error: { code: err.code, message: err.message } }, { status: err.code === "NOT_FOUND" ? 404 : 409 });
    }
    throw err;
  }
}
