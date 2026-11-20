import "server-only";
import { hmacHex, timingSafeEqual } from "@/lib/crypto";

/**
 * Paystack over plain `fetch` (no SDK), so it runs on any host.
 * Docs: https://paystack.com/docs/api/transaction/ and https://paystack.com/docs/payments/webhooks/
 *
 * The server decides every amount and every reference. The browser only ever gets an
 * access code to open the popup, and a payment counts only after Verify Transaction says so.
 */

const API = "https://api.paystack.co";

/** Paystack's published webhook source addresses. A request from elsewhere is logged, not blocked. */
export const PAYSTACK_WEBHOOK_IPS = ["52.31.139.75", "52.49.173.169", "52.214.14.220"];

export class PaystackError extends Error {
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
    this.name = "PaystackError";
  }
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new PaystackError("PAYSTACK_SECRET_KEY is not set.");
  return key;
}

/** Mirrors the dashboard's "pass fees to customers", so pages can say a fee is added. */
export function customerPaysFees(): boolean {
  return process.env.PAYSTACK_CUSTOMER_PAYS_FEES === "true";
}

/** True when the secret key is set, so online payment can be offered. */
export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new PaystackError(`Couldn't reach Paystack: ${err instanceof Error ? err.message : String(err)}`);
  }
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status || body.data === undefined) {
    throw new PaystackError(body?.message ?? `Paystack answered ${res.status}.`, res.status);
  }
  return body.data;
}

export interface InitializeInput {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata: Record<string, string>;
}

/** Starts a transaction and returns the access code the popup resumes. */
export async function initializeTransaction(input: InitializeInput): Promise<{ accessCode: string; authorizationUrl: string }> {
  const data = await call<{ access_code: string; authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: ["card", "bank_transfer", "bank", "ussd"],
      metadata: input.metadata,
    }),
  });
  return { accessCode: data.access_code, authorizationUrl: data.authorization_url };
}

export interface VerifiedTransaction {
  reference: string;
  /** Paystack's word for it: success, failed, abandoned, ongoing, pending, reversed, ... */
  status: string;
  /** What the customer was charged, including Paystack's fee when it is passed to them. */
  amountKobo: number;
  /** What we asked for at initialize. Equals `amountKobo` unless Paystack added its fee on top. */
  requestedKobo: number;
  /** Paystack's whole fee for the charge, whoever bears it. Null until the charge succeeds. */
  feesKobo: number | null;
  currency: string;
  channel: string;
  paidAt: string | null;
}

/** The only source of truth for whether money arrived. */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const data = await call<{
    reference: string;
    status: string;
    amount: number;
    requested_amount?: number | null;
    fees?: number | null;
    currency: string;
    channel: string;
    paid_at: string | null;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    reference: data.reference,
    status: data.status,
    amountKobo: data.amount,
    requestedKobo: data.requested_amount ?? data.amount,
    feesKobo: data.fees ?? null,
    currency: data.currency,
    channel: data.channel,
    paidAt: data.paid_at,
  };
}

/** Checks `x-paystack-signature`: HMAC SHA-512 of the raw body, keyed with the secret key. */
export async function isValidSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature || !isPaystackConfigured()) return false;
  return timingSafeEqual(await hmacHex("SHA-512", secretKey(), rawBody), signature.toLowerCase());
}
