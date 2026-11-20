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
