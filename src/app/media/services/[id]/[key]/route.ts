import { db } from "@/server/db";

/** One year: the address carries a key that changes with every new photo, so it never goes stale. */
const FOREVER = "public, max-age=31536000, immutable";

/**
 * GET /media/services/:id/:key, a service's photo. Only the current key works, so an old address
 * stops serving once the photo is replaced or removed. Browsers and Netlify's cache keep it.
 */
export async function GET(_: Request, ctx: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await ctx.params;
  if (id.length > 40 || key.length > 40) return notFound();
  const row = await db.service.findFirst({
    where: { id, photoKey: key },
    select: { photo: { select: { data: true, contentType: true } } },
  });
  if (!row?.photo) return notFound();
  return new Response(Uint8Array.from(row.photo.data), {
    headers: {
      "Content-Type": row.photo.contentType,
      "Content-Length": String(row.photo.data.byteLength),
      "Cache-Control": FOREVER,
      "Netlify-CDN-Cache-Control": `${FOREVER}, durable`,
      "Content-Disposition": "inline",
    },
  });
}

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}
