import type { SocialPlatform } from "@/config/business";

/**
 * Simple outline glyphs for social platforms, drawn in the same 24px,
 * 2px-stroke style as the lucide icons used elsewhere (lucide no longer ships
 * brand marks). Decorative: the surrounding link carries the accessible name.
 */
export function SocialIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };
  switch (platform) {
    case "instagram":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <path d="M17.5 6.5h.01" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 3c.4 2.6 2.4 4.6 5 5" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
          <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8c-1-.5-2-1.5-2.5-2.5l.8-1-1-2z" />
        </svg>
      );
  }
}
