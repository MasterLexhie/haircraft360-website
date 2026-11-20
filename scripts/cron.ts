/**
 * `npm run cron`: one scheduler run against the local dev server, as cron-job.org does in
 * production. Run it as often as you like; nothing is ever sent twice.
 * Reads CRON_SECRET and NEXT_PUBLIC_SITE_URL from .env.local.
 */
async function main(): Promise<number> {
  const base = (process.env.CRON_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set. Add it to .env.local.");
    return 1;
  }
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${base}/api/cron/notifications`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  } catch (err) {
    console.error(`Couldn't reach ${base}: ${err instanceof Error ? err.message : String(err)}. Is the dev server running?`);
    return 1;
  }
  console.log(`${res.status} ${await res.text()} (${Date.now() - started} ms)`);
  return res.ok ? 0 : 1;
}

main().then((code) => process.exit(code));
