import type { Kobo } from "@/domain/types";

const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format integer kobo as Naira, e.g. 450000 -> "₦4,500". */
export function formatNaira(kobo: Kobo): string {
  return ngn.format(kobo / 100);
}

/** Parse a user-typed Naira amount ("4,500", "₦4500.50") into integer kobo. */
export function parseNairaToKobo(input: string): Kobo | null {
  const cleaned = input.replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Kobo -> plain naira string for form inputs, e.g. 450000 -> "4500". */
export function koboToInput(kobo: Kobo | null): string {
  if (kobo === null) return "";
  return kobo % 100 === 0 ? String(kobo / 100) : (kobo / 100).toFixed(2);
}
