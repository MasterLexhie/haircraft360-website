import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/site-env";

/**
 * Staging blocks every crawler. Elsewhere crawling is allowed; private pages stay out of search
 * through their noindex header instead of being listed here (BUILD_SPEC 6.9).
 */
export default function robots(): MetadataRoute.Robots {
  return isStaging() ? { rules: { userAgent: "*", disallow: "/" } } : { rules: { userAgent: "*", allow: "/" } };
}
