import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import nextConfig from "../../next.config";
import { isStaging } from "@/lib/site-env";

afterEach(() => vi.unstubAllEnvs());

const robotsHeaderFor = async (path: string) => {
  const rules = (await nextConfig.headers!()) as { source: string; headers: { key: string; value: string }[] }[];
  return rules.filter((r) => r.source === path).flatMap((r) => r.headers).find((h) => h.key === "X-Robots-Tag")?.value;
};

describe("staging copy", () => {
  it("is off unless SITE_ENV says staging", () => {
    vi.stubEnv("SITE_ENV", "");
    expect(isStaging()).toBe(false);
    vi.stubEnv("SITE_ENV", " Staging ");
    expect(isStaging()).toBe(true);
  });

  it("blocks every crawler and noindexes every page on staging", async () => {
    vi.stubEnv("SITE_ENV", "staging");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(await robotsHeaderFor("/:path*")).toBe("noindex, nofollow");
  });

  it("allows crawling of public pages elsewhere, with private pages still noindexed", async () => {
    vi.stubEnv("SITE_ENV", "");
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
    expect(await robotsHeaderFor("/:path*")).toBeUndefined();
    expect(await robotsHeaderFor("/admin/:path*")).toBe("noindex, nofollow");
  });
});
