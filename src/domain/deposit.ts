/**
 * Deposit rule from Settings (BUILD_SPEC 6.3): a fixed amount or a percentage,
 * applied to the main service only or to the full total, with an optional minimum
 * for percentage rules. Pure, so it is shared by the server and the booking summary.
 */

export interface DepositRule {
  type: "fixed" | "percent";
  fixedKobo: number;
  percent: number;
  scope: "main_only" | "full_total";
  /** Floor for percentage deposits. null = no minimum. */
  minimumKobo: number | null;
}

export interface DepositInput {
  mainServiceKobo: number;
  totalKobo: number;
}

const roundToNaira = (kobo: number) => Math.round(kobo / 100) * 100;

/** Deposit due now, in kobo. Never more than the booking total. */
export function depositDue(input: DepositInput, rule: DepositRule): number {
  const base = rule.scope === "main_only" ? input.mainServiceKobo : input.totalKobo;
  let deposit = rule.type === "fixed" ? rule.fixedKobo : roundToNaira((base * rule.percent) / 100);
  if (rule.type === "percent" && rule.minimumKobo !== null) deposit = Math.max(deposit, rule.minimumKobo);
  return Math.max(0, Math.min(deposit, input.totalKobo));
}
