import { BookingError, createPendingBooking } from "@/server/booking-service";
import { isMockCheckoutEnabled, startMockCheckout } from "@/server/payments/mock";
import { clientIpFrom, hit, LIMITS, retryMessage } from "@/server/rate-limit";
import { badRequest, createBookingSchema, readJson } from "@/domain/schemas";

/** POST /api/bookings: hold a time and record the booking awaiting its deposit. */
export async function POST(request: Request) {
  const limit = await hit(`booking:ip:${clientIpFrom(request.headers)}`, LIMITS.bookingPerIp);
  if (!limit.ok) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: `Too many booking attempts. ${retryMessage(limit.retryAfterSeconds)}` } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const parsed = createBookingSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("Please check your booking details and try again.");
  const body = parsed.data;
  // Honeypot: a hidden field people never fill. Bots that fill it get a generic refusal.
  if (body.website?.trim()) return badRequest("Please check your details and try again.");
  try {
    const result = await createPendingBooking(body);
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
