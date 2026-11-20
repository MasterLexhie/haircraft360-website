import { timingSafeEqual } from "@/lib/crypto";
import { runScheduler } from "@/server/notifications";

/**
 * /api/cron/notifications (BUILD_SPEC 6.4): called hourly by cron-job.org, and locally by
 * `npm run cron`. Needs `Authorization: Bearer <CRON_SECRET>`. Answers in a few seconds with a
 * one-line summary, for example `ok sent=3 skipped=1 retrying=0 failed=0`.
 * cron-job.org times out after 30 seconds and does not retry, so a run stops sending at 20.
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("not configured", { status: 500 });
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!timingSafeEqual(given, secret)) return new Response("unauthorized", { status: 401 });

  try {
    const r = await runScheduler({ budgetMs: 20_000 });
    const parts = [`ok sent=${r.sent}`, `skipped=${r.skipped}`, `retrying=${r.retrying}`, `failed=${r.failed}`];
    if (r.stopped) parts.push(`stopped=${r.stopped}`);
    return new Response(parts.join(" "), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(`[cron] run failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    return new Response("error", { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
