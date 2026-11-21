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

  it("reads the visitor IP only from the header the host sets", () => {
    const sent = { "x-nf-client-connection-ip": "1.2.3.4", "cf-connecting-ip": "6.6.6.6", "x-forwarded-for": "7.7.7.7, 9.9.9.9" };
    expect(clientIpFrom(new Headers(sent), "netlify")).toBe("1.2.3.4");
    expect(clientIpFrom(new Headers(sent), "cloudflare")).toBe("6.6.6.6");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }), undefined)).toBe("10.0.0.1");
    expect(clientIpFrom(new Headers(), undefined)).toBe("local");
  });

  it("ignores IP headers a visitor types on Netlify", () => {
    const faked = (ip: string) => new Headers({ "x-nf-client-connection-ip": "1.2.3.4", "cf-connecting-ip": ip, "x-forwarded-for": ip, "x-real-ip": ip });
    expect(new Set(["10.0.0.1", "10.0.0.2", "10.0.0.3"].map((ip) => clientIpFrom(faked(ip), "netlify")))).toEqual(new Set(["1.2.3.4"]));
  });
});
