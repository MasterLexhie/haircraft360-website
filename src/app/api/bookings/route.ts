import { BookingError, createPendingBooking } from "@/server/booking-service";

/** POST /api/bookings — hold a slot and open a demo deposit checkout. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "VALIDATION", message: "Invalid request." } }, { status: 400 });
  }
  try {
    const result = createPendingBooking({
      serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds.map(String) : [],
      startAt: String(body.startAt ?? ""),
      name: String(body.name ?? ""),
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      customerNote: String(body.customerNote ?? ""),
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      const status = err.code === "SLOT_TAKEN" ? 409 : 400;
      return Response.json({ error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } }, { status });
    }
    throw err;
  }
}
