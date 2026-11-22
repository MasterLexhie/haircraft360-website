/**
 * Finances is one section with two tabs, Overview and Expenses, sharing the period. The add
 * expense form returns to the tab (and period) it was opened from: `back` carries that path,
 * and only a Finances path is accepted, so the link can't send the owner anywhere else.
 */
export const FINANCES_PATH = "/admin/finances";
export const EXPENSES_PATH = "/admin/finances/expenses";
export const NEW_EXPENSE_PATH = "/admin/finances/expenses/new";

const RETURN = /^\/admin\/finances(\/expenses)?(\?[\w\-=&%.]*)?$/;

export function financeReturn(raw: string | undefined | null): string {
  return raw && RETURN.test(raw) ? raw : EXPENSES_PATH;
}

export type PeriodParams = { period?: string; from?: string; to?: string };

/** The period part of a Finances address, plus any extra filters. */
export function financeHref(path: string, period: PeriodParams, extra: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ period: period.period, from: period.from, to: period.to, ...extra })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export function newExpenseHref(back: string): string {
  return `${NEW_EXPENSE_PATH}?back=${encodeURIComponent(back)}`;
}
