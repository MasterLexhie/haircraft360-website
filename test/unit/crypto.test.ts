import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, hmacHex, randomToken, sha256Hex, timingSafeEqual, verifyPassword } from "@/lib/crypto";

describe("crypto helpers", () => {
  it("makes long, unique, URL-safe tokens", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes with SHA-256", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("matches Node's HMAC SHA-512 (the Paystack webhook signature)", async () => {
    const expected = createHmac("sha512", "sk_test_x").update('{"event":"charge.success"}').digest("hex");
    expect(await hmacHex("SHA-512", "sk_test_x", '{"event":"charge.success"}')).toBe(expected);
  });

  it("compares strings safely", () => {
    expect(timingSafeEqual("same", "same")).toBe(true);
    expect(timingSafeEqual("same", "diff")).toBe(false);
    expect(timingSafeEqual("short", "longer value")).toBe(false);
  });

  it("hashes and verifies passwords, with a fresh salt each time", async () => {
    const h1 = await hashPassword("correct horse battery", 1000);
    const h2 = await hashPassword("correct horse battery", 1000);
    expect(h1).not.toBe(h2);
    expect(h1).toMatch(/^pbkdf2-sha256\$1000\$/);
    expect(await verifyPassword("correct horse battery", h1)).toBe(true);
    expect(await verifyPassword("wrong password", h1)).toBe(false);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$10$abc$def")).toBe(false);
  });
});
