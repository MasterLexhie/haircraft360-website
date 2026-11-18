import { describe, expect, it } from "vitest";
import { depositDue, type DepositRule } from "@/domain/deposit";

const base: DepositRule = { type: "percent", fixedKobo: 0, percent: 30, scope: "full_total", minimumKobo: null };

describe("depositDue", () => {
  it("takes a percentage of the full total, rounded to the naira", () => {
    expect(depositDue({ mainServiceKobo: 1_500_000, totalKobo: 1_833_333 }, base)).toBe(550_000);
  });

  it("can apply the percentage to the main service only", () => {
    expect(depositDue({ mainServiceKobo: 1_500_000, totalKobo: 2_300_000 }, { ...base, scope: "main_only" })).toBe(450_000);
  });

  it("charges a fixed amount, capped at the total", () => {
    const rule: DepositRule = { ...base, type: "fixed", fixedKobo: 1_000_000 };
    expect(depositDue({ mainServiceKobo: 2_000_000, totalKobo: 2_000_000 }, rule)).toBe(1_000_000);
    expect(depositDue({ mainServiceKobo: 500_000, totalKobo: 500_000 }, rule)).toBe(500_000);
  });

  it("applies the optional minimum to percentage rules only", () => {
    expect(depositDue({ mainServiceKobo: 500_000, totalKobo: 500_000 }, { ...base, minimumKobo: 200_000 })).toBe(200_000);
    expect(depositDue({ mainServiceKobo: 500_000, totalKobo: 500_000 }, { ...base, type: "fixed", fixedKobo: 100_000, minimumKobo: 200_000 })).toBe(100_000);
  });

  it("never exceeds the total, even with a minimum", () => {
    expect(depositDue({ mainServiceKobo: 100_000, totalKobo: 100_000 }, { ...base, minimumKobo: 200_000 })).toBe(100_000);
  });

  it("is zero for a zero total", () => {
    expect(depositDue({ mainServiceKobo: 0, totalKobo: 0 }, base)).toBe(0);
  });
});
