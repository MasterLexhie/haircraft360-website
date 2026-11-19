import { BookingError, createPendingBooking } from "@/server/booking-service";
import { isMockCheckoutEnabled, startMockCheckout } from "@/server/payments/mock";
import { clientIpFrom, hit, LIMITS, retryMessage } from "@/server/rate-limit";

/** POST /api/bookings: hold a time and record the booking awaiting its deposit. */
export async function POST(request: Request) {
  const limit = await hit(`booking:ip:${clientIpFrom(request.headers)}`, LIMITS.bookingPerIp);
  if (!limit.ok) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: `Too many booking attempts. ${retryMessage(limit.retryAfterSeconds)}` } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "VALIDATION", message: "Invalid request." } }, { status: 400 });
  }
  // Honeypot: a hidden field people never fill. Bots that fill it get a generic refusal.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return Response.json({ error: { code: "VALIDATION", message: "Please check your details and try again." } }, { status: 400 });
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
