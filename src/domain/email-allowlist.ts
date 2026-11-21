/**
 * The staging copy must never email a real person. With EMAIL_ALLOWLIST set (comma-separated
 * addresses, or "@domain" for a whole domain), email goes only to listed addresses. On staging
 * with no list at all, nothing is sent. Production and local development leave both unset.
 */

/** Stored on a notification that the allowlist held back. */
export const ALLOWLIST_NOTE = "Not sent: this staging copy only emails addresses on its allowlist";

export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function emailAllowed(to: string, allowlistRaw: string | undefined, staging: boolean): boolean {
  const list = parseAllowlist(allowlistRaw);
  if (list.length === 0) return !staging;
  const address = to.trim().toLowerCase();
  return list.some((entry) => (entry.startsWith("@") ? address.endsWith(entry) : address === entry));
}
