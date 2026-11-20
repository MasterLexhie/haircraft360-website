import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { clientIpFrom, hit, LIMITS } from "@/server/rate-limit";
import { settlePayment } from "@/server/payments/checkout";
import { isValidSignature, PAYSTACK_WEBHOOK_IPS } from "@/server/payments/paystack";

/**
 * POST /api/webhooks/paystack (BUILD_SPEC 6.4).
 *
 * 1. The signature is checked on the raw body before anything is trusted.
 * 2. Every event is stored, valid or not, as evidence.
 * 3. A charge is never taken from the event itself: `settlePayment` asks Verify Transaction,
 *    then records it once (duplicates and any order of arrival are safe).
 *
 * A failure answers 500 so Paystack retries; everything else answers 200 straight away.
 * Paystack's events are a few KB, so anything large is refused before it is read or stored.
 */
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return new Response("too large", { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("too large", { status: 413 });
  const sourceIp = clientIpFrom(request.headers);
  const signatureValid = await isValidSignature(raw, request.headers.get("x-paystack-signature"));
  // Bad signatures are kept as evidence, but only so many per sender: the URL is public.
  if (!signatureValid && !(await hit(`webhook-bad:ip:${sourceIp}`, LIMITS.webhookBadSignaturePerIp)).ok) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: { event?: unknown; data?: { reference?: unknown } } | null = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }
  const eventType = typeof payload?.event === "string" ? payload.event.slice(0, 100) : "unknown";
  const reference = typeof payload?.data?.reference === "string" ? payload.data.reference.slice(0, 100) : null;
  const unknownIp = sourceIp !== "local" && !PAYSTACK_WEBHOOK_IPS.includes(sourceIp);

  const event = await db.webhookEvent.create({
    data: {
      eventType,
      reference,
      // Only a signed event is stored whole; anything else is kept short.
      payload: (signatureValid && payload ? payload : { raw: raw.slice(0, 2000) }) as Prisma.InputJsonValue,
      signatureValid,
      sourceIp,
      status: signatureValid ? "received" : "ignored",
      error: signatureValid ? (unknownIp ? "Sent from an address outside Paystack's published list" : null) : "Bad or missing signature",
    },
  });
  if (unknownIp) console.warn(`[webhook] ${event.id} came from ${sourceIp}, not a published Paystack address`);
  if (!signatureValid) return new Response("invalid signature", { status: 401 });

  if (eventType !== "charge.success" || !reference) {
    await db.webhookEvent.update({ where: { id: event.id }, data: { status: "ignored", processedAt: new Date() } });
    return new Response("ok");
  }

  try {
    const outcome = await settlePayment(reference, "Paystack");
    if (outcome === "pending") {
      // Paystack signed a success but Verify doesn't agree yet. Answer 500 so Paystack sends
      // it again later; otherwise a payment whose customer closed the page would never land.
      await db.webhookEvent.update({ where: { id: event.id }, data: { status: "failed", error: "Verify doesn't show success yet; Paystack will retry", processedAt: new Date() } });
      return new Response("not yet", { status: 500 });
    }
    await db.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: outcome === "unknown" ? "ignored" : "processed",
        error: outcome === "unknown" ? "No payment attempt with this reference" : outcome === "paid" ? event.error : `Verify said ${outcome}`,
        processedAt: new Date(),
      },
    });
    return new Response("ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] ${event.id} ${reference} failed: ${message}`);
    await db.webhookEvent.update({ where: { id: event.id }, data: { status: "failed", error: message.slice(0, 500), processedAt: new Date() } });
    return new Response("error", { status: 500 });
  }
}
