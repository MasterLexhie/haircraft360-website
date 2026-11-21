import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy without nonces (BUILD_SPEC 6.8). Nonces would force every
 * page to render per request and are incompatible with partial prerendering
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md), so inline
 * scripts are allowed and everything else is locked to this site plus Paystack.
 * Paystack: the popup is bundled from @paystack/inline-js and opens checkout.paystack.com in an
 * iframe; on Safari it loads Apple's Apple Pay script. api.paystack.co is called from the popup.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://applepay.cdn-apple.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' https://api.paystack.co${isDev ? " ws: wss:" : ""}`,
  "frame-src https://checkout.paystack.com https://*.paystack.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.paystack.com\")" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

/** Private and token pages stay out of search engines (BUILD_SPEC 6.9). Not listed in robots.txt. */
const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The dev badge overlaps the fixed mobile booking bar; hide it while testing.
  devIndicators: false,
  partialPrefetching: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The staging copy (SITE_ENV=staging) is kept out of every search engine.
      ...(process.env.SITE_ENV?.trim().toLowerCase() === "staging" ? [{ source: "/:path*", headers: noindex }] : []),
      { source: "/admin/:path*", headers: noindex },
      { source: "/admin", headers: noindex },
      { source: "/booking/:path*", headers: noindex },
      { source: "/pay/:path*", headers: noindex },
      { source: "/api/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
