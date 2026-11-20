"use client";

import { useState } from "react";

/** What the server hands back when it opens a payment (see src/server/payments/checkout.ts). */
export interface StartedPayment {
  reference: string;
  accessCode: string;
  amountKobo: number;
}

/** `error`: the popup itself couldn't load; nothing was charged. */
export type PaymentOutcome = "paid" | "pending" | "failed" | "cancelled" | "error";
export type PaymentPhase = "idle" | "starting" | "open" | "confirming";

const POLL_MS = 3_000;
const POLL_FOR_MS = 60_000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Opens the Paystack popup over the page. Loaded on demand so it never runs on the server. */
async function openPopup(accessCode: string): Promise<"success" | "cancel" | { error: string }> {
  const { default: PaystackPop } = await import("@paystack/inline-js");
  return new Promise((resolve) => {
    new PaystackPop().resumeTransaction(accessCode, {
      onSuccess: () => resolve("success"),
      onCancel: () => resolve("cancel"),
      onError: (e) => resolve({ error: e?.message || "The payment window couldn't load." }),
    });
  });
}

async function verify(reference: string): Promise<string> {
  const res = await fetch(`/api/payments/${reference}/verify`, { method: "POST" });
  return res.ok ? ((await res.json()).outcome as string) : "pending";
}

async function poll(reference: string): Promise<string> {
  const res = await fetch(`/api/payments/${reference}`, { cache: "no-store" });
  return res.ok ? ((await res.json()).outcome as string) : "pending";
}

/**
 * Popup, then confirmation. After the popup says "success" we ask the server to verify with
 * Paystack (so the booking confirms even if the webhook is slow), then poll our own records
 * for up to a minute: bank transfers can take a little while to land.
 */
async function confirm(reference: string): Promise<PaymentOutcome> {
  let outcome = await verify(reference).catch(() => "pending");
  const until = Date.now() + POLL_FOR_MS;
  while (outcome !== "paid" && outcome !== "failed" && Date.now() < until) {
    await wait(POLL_MS);
    outcome = await poll(reference).catch(() => "pending");
  }
  if (outcome !== "paid" && outcome !== "failed") outcome = await verify(reference).catch(() => "pending");
  return outcome === "paid" ? "paid" : outcome === "failed" ? "failed" : "pending";
}

/**
 * Runs one payment from start to finish. `start` asks our server for a fresh transaction
 * (or returns one already opened); `onDone` gets the outcome.
 */
export function usePaystackPayment(onDone: (outcome: PaymentOutcome) => void) {
  const [phase, setPhase] = useState<PaymentPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  async function pay(start: () => Promise<StartedPayment>) {
    setError(null);
    setPhase("starting");
    let started: StartedPayment;
    try {
      started = await start();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't open the payment. Please try again.");
      setPhase("idle");
      return;
    }
    setPhase("open");
    const result = await openPopup(started.accessCode).catch(() => ({ error: "The payment window couldn't load. Check your connection and try again." }));
    if (result === "cancel") {
      // A customer who sent a transfer often closes the window before Paystack shows it
      // received. Ask once, so they aren't shown an unpaid booking and pay twice.
      setPhase("confirming");
      const outcome = await verify(started.reference).catch(() => "pending");
      setPhase("idle");
      onDone(outcome === "paid" ? "paid" : "cancelled");
      return;
    }
    if (typeof result === "object") {
      setError(result.error);
      setPhase("idle");
      onDone("error");
      return;
    }
    setPhase("confirming");
    const outcome = await confirm(started.reference);
    if (outcome === "failed") {
      setError("The payment didn't go through and nothing was charged. Please try again.");
      setPhase("idle");
    }
    onDone(outcome);
  }

  return { pay, phase, error, busy: phase !== "idle" };
}

/** POSTs to one of our "start a payment" routes and returns the payment, or throws its message. */
export async function startPayment(url: string, body: unknown): Promise<StartedPayment> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("We couldn't reach the payment service. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "We couldn't open the payment. Please try again.");
  return data as StartedPayment;
}
