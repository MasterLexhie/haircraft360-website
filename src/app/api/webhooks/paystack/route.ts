import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { clientIpFrom } from "@/server/rate-limit";
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
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const sourceIp = clientIpFrom(request.headers);
  const signatureValid = await isValidSignature(raw, request.headers.get("x-paystack-signature"));

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
      payload: (payload ?? { raw: raw.slice(0, 2000) }) as Prisma.InputJsonValue,
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
