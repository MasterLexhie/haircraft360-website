import { vi } from "vitest";

export const SECRET = "sk_test_fake_secret_for_tests";

/**
 * A stand-in for Paystack's API. Tests decide what Verify Transaction says per reference;
 * every request is checked for the secret key so the client is exercised as for real.
 */
export const paystack = {
  initialized: [] as { reference: string; amount: number; email: string; currency: string }[],
  verify: new Map<string, PaidExtra & { status: string }>(),
  down: false,
};

interface PaidExtra {
  /** What the customer paid in total; defaults to what we asked plus `customerFee`. */
  amount?: number;
  /** Paystack's fee added on top of our amount (dashboard "pass fees to customers"). */
  customerFee?: number;
  /** Paystack's whole fee as Verify reports it. */
  fees?: number;
  /** Overrides `requested_amount`, to fake a mismatch. */
  requested?: number;
  currency?: string;
  channel?: string;
}

export function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const auth = new Headers(init?.headers).get("authorization");
  if (paystack.down) return Promise.reject(new TypeError("fetch failed"));
  if (auth !== `Bearer ${SECRET}`) return Promise.resolve(Response.json({ status: false, message: "Invalid key" }, { status: 401 }));
  if (url.pathname === "/transaction/initialize") {
    const body = JSON.parse(String(init?.body));
    paystack.initialized.push({ reference: body.reference, amount: body.amount, email: body.email, currency: body.currency });
    return Promise.resolve(Response.json({ status: true, data: { access_code: `ac_${body.reference}`, authorization_url: "https://checkout.paystack.com/x", reference: body.reference } }));
  }
  const m = url.pathname.match(/^\/transaction\/verify\/(.+)$/);
  if (m) {
    const reference = decodeURIComponent(m[1]!);
    const init = paystack.initialized.find((i) => i.reference === reference);
    const v = paystack.verify.get(reference) ?? { status: "abandoned" };
    return Promise.resolve(
      Response.json({
        status: true,
        data: {
          reference,
          status: v.status,
          amount: v.amount ?? (init?.amount ?? 0) + (v.customerFee ?? 0),
          requested_amount: v.requested ?? init?.amount ?? 0,
          fees: v.status === "success" ? (v.fees ?? v.customerFee ?? null) : null,
          currency: v.currency ?? "NGN",
          channel: v.channel ?? "card",
          paid_at: null,
        },
      }),
    );
  }
  return Promise.resolve(Response.json({ status: false, message: "Not found" }, { status: 404 }));
}

/** Fake Paystack on, with an empty database ready for bookings. Call from `beforeEach`. */
export function usePaystackFake() {
  vi.stubEnv("PAYSTACK_SECRET_KEY", SECRET);
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  paystack.initialized = [];
  paystack.verify.clear();
  paystack.down = false;
}

/** Pays the attempt in the fake Paystack, as if the customer finished the popup. */
export function paid(reference: string, extra: PaidExtra = {}) {
  paystack.verify.set(reference, { status: "success", ...extra });
}
