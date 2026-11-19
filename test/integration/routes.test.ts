import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetDatabase } from "../db";
import { bookingInput, createServices, createSettings } from "../factories";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { POST: createBooking } = await import("@/app/api/bookings/route");
const { POST: startCheckout } = await import("@/app/api/bookings/[reference]/checkout/route");
const { GET: availability } = await import("@/app/api/availability/route");

let ipSeq = 0;
function post(body: unknown, raw?: string) {
  ipSeq++;
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${ipSeq}` },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetDatabase();
  await createSettings();
  await createServices();
});

describe("input validation on public routes", () => {
  it("accepts a well-formed booking", async () => {
    const res = await createBooking(post(bookingInput()));
    expect(res.status).toBe(201);
  });

  it.each([
    ["malformed JSON", undefined, "{not json"],
    ["missing service", { ...bookingInput(), mainServiceId: undefined }, undefined],
    ["a start time that isn't a date", { ...bookingInput(), startAt: "tomorrow" }, undefined],
    ["too many add-ons", { ...bookingInput(), addOnIds: Array.from({ length: 50 }, (_, i) => `a${i}`) }, undefined],
    ["an oversized note", { ...bookingInput(), customerNote: "x".repeat(5000) }, undefined],
    ["a filled honeypot", { ...bookingInput(), website: "http://spam.example" }, undefined],
  ])("rejects %s with a plain 400", async (_, body, raw) => {
    const res = await createBooking(post(body, raw));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION");
    expect(JSON.stringify(json)).not.toMatch(/at \w+ \(|node_modules|prisma/i);
  });

  it("limits booking attempts per IP", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const req = new Request("http://localhost/api/bookings", { method: "POST", headers: { "x-forwarded-for": "198.51.100.7" }, body: "{}" });
      statuses.push((await createBooking(req)).status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 400)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("rejects a checkout request without a proper token", async () => {
    const req = new Request("http://localhost/api/bookings/HC-ABCDE/checkout", { method: "POST", body: JSON.stringify({ token: "x" }) });
    const res = await startCheckout(req, { params: Promise.resolve({ reference: "HC-ABCDE" }) });
    expect(res.status).toBe(400);
  });

  it("rejects bad availability queries", async () => {
    for (const q of ["duration=abc", "duration=5", "duration=60&date=2026-13-45", "duration=60&date=<script>"]) {
      const res = await availability(new NextRequest(`http://localhost/api/availability?${q}`));
      expect(res.status).toBe(400);
    }
    expect((await availability(new NextRequest("http://localhost/api/availability?duration=60"))).status).toBe(200);
  });
});
