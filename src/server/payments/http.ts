import "server-only";
import { BookingError } from "../booking-service";
import { PaystackError } from "./paystack";

/** Turns a payment error into the JSON error shape the browser expects. Anything else is rethrown. */
export function paymentErrorResponse(err: unknown): Response {
  if (err instanceof BookingError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "PAYMENT_UNAVAILABLE" ? 503 : 409;
    return Response.json({ error: { code: err.code, message: err.message } }, { status });
  }
  if (err instanceof PaystackError) {
    console.error(`[payments] ${err.message}`);
    return Response.json({ error: { code: "PAYMENT_UNAVAILABLE", message: "We couldn't check the payment with Paystack just now. Please try again in a minute." } }, { status: 503 });
  }
  throw err;
}
