import { BookingError, createPendingBooking } from "@/server/booking-service";
import { isMockCheckoutEnabled, startMockCheckout } from "@/server/payments/mock";

/** POST /api/bookings: hold a time and record the booking awaiting its deposit. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "VALIDATION", message: "Invalid request." } }, { status: 400 });
  }
  try {
    const result = await createPendingBooking({
      mainServiceId: String(body.mainServiceId ?? ""),
      addOnIds: Array.isArray(body.addOnIds) ? body.addOnIds.map(String) : [],
      startAt: String(body.startAt ?? ""),
      name: String(body.name ?? ""),
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      noEmail: body.noEmail === true,
      marketingConsent: body.marketingConsent === true,
      customerNote: String(body.customerNote ?? ""),
    });
    // Until Paystack is connected (Milestone 4), local development pays through the mock checkout.
    const checkout = isMockCheckoutEnabled() ? await startMockCheckout(result.reference, result.accessToken, "deposit") : null;
    return Response.json({ reference: result.reference, accessToken: result.accessToken, checkoutReference: checkout?.checkoutReference ?? null }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      const status = err.code === "SLOT_TAKEN" ? 409 : err.code === "TOO_MANY_HOLDS" ? 429 : 400;
      return Response.json({ error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } }, { status });
    }
    throw err;
  }
}
