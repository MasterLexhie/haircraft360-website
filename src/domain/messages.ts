/**
 * Fills the owner's message templates (Settings > message templates). Placeholders are
 * {name}, {service}, {date}, {time}, {total}, {deposit}, {balance}, {link}, {salon} and
 * {address}. A placeholder without a value is left as typed, so a mistake is visible.
 */
export type MessageVars = Partial<Record<"name" | "service" | "date" | "time" | "total" | "deposit" | "balance" | "link" | "salon" | "address", string>>;

export function fillTemplate(template: string, vars: MessageVars): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = (vars as Record<string, string | undefined>)[key];
    return value === undefined ? whole : value;
  });
}

export const MESSAGE_PLACEHOLDERS = ["name", "service", "date", "time", "total", "deposit", "balance", "link", "salon", "address"] as const;

/** Placeholders in a template that won't be filled in, such as a typo like {nmae}. */
export function unknownPlaceholders(template: string): string[] {
  const known = new Set<string>(MESSAGE_PLACEHOLDERS);
  return [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].filter((k) => !known.has(k));
}
