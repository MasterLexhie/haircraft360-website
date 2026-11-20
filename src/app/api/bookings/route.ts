import { BookingError, createPendingBooking } from "@/server/booking-service";
import { startBookingPayment, type StartedPayment } from "@/server/payments/checkout";
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
    // Opens the deposit payment straight away to save a round trip. If Paystack is down the
    // booking still stands (held), and the customer can pay from their booking page.
    let payment: StartedPayment | null = null;
    try {
      payment = await startBookingPayment(result.reference, result.accessToken, "deposit");
    } catch (err) {
      if (!(err instanceof BookingError)) throw err;
    }
    return Response.json({ reference: result.reference, accessToken: result.accessToken, payment }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      const status = err.code === "SLOT_TAKEN" ? 409 : err.code === "TOO_MANY_HOLDS" ? 429 : 400;
      return Response.json({ error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } }, { status });
    }
    throw err;
  }
}
