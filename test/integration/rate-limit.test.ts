import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase } from "../db";
import { clientIpFrom, hit } from "@/server/rate-limit";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

beforeEach(resetDatabase);

describe("rate limiter", () => {
  const limit = { limit: 3, windowSeconds: 60 };

  it("allows up to the limit, then refuses until the window ends", async () => {
    const now = Date.UTC(2026, 10, 19, 10, 0, 10);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hit("test:a", limit, now));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBe(50);
    expect((await hit("test:a", limit, now + 60_000)).ok).toBe(true);
  });

  it("counts each key separately", async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) await hit("test:b", limit, now);
    expect((await hit("test:b", limit, now)).ok).toBe(false);
    expect((await hit("test:c", limit, now)).ok).toBe(true);
  });

  it("counts correctly under concurrent requests", async () => {
    const now = Date.now();
    const results = await Promise.all(Array.from({ length: 10 }, () => hit("test:d", limit, now)));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
  });

  it("reads the visitor IP from the edge headers", () => {
    expect(clientIpFrom(new Headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIpFrom(new Headers())).toBe("local");
  });
});
