/**
 * Which copy of the site this is. `SITE_ENV=staging` marks the test copy on the developer's
 * accounts: nothing is indexed, robots.txt blocks every crawler, every page shows a "Staging"
 * mark, and email only goes to the allowlist. Unset in production and locally.
 */
export function isStaging(): boolean {
  return process.env.SITE_ENV?.trim().toLowerCase() === "staging";
}
