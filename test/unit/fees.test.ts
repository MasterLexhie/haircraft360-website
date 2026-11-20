import { describe, expect, it } from "vitest";
import { paystackFeeOnTop } from "@/domain/fees";

describe("Paystack fee passed to the customer", () => {
  it("matches what Paystack charged for a ₦2,000 deposit in test mode (₦2,030.46)", () => {
    expect(paystackFeeOnTop(200_000)).toBe(3_046);
  });

  it("adds the ₦100 only once the charge reaches ₦2,500", () => {
    // ₦2,450 grosses up to ₦2,487.31: still under ₦2,500, so no flat fee.
    expect(paystackFeeOnTop(245_000)).toBe(3_731);
    // ₦2,480 would gross up past ₦2,500, so the flat fee applies.
    expect(248_000 + paystackFeeOnTop(248_000)).toBeGreaterThan(250_000);
    expect(paystackFeeOnTop(248_000)).toBe(Math.round((248_000 + 10_000) / 0.985) - 248_000);
  });

  it("never exceeds the ₦2,000 cap", () => {
    expect(paystackFeeOnTop(50_000_000)).toBe(200_000);
  });

  it("is nothing for nothing", () => {
    expect(paystackFeeOnTop(0)).toBe(0);
  });
});
