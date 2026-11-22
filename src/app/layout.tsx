import type { Metadata, Viewport } from "next";
import { Fraunces, Montserrat, Playfair_Display, Shrikhand } from "next/font/google";
import "./globals.css";
import { isStaging } from "@/lib/site-env";
import { StagingMark } from "@/components/staging-mark";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  style: ["normal", "italic"],
});
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
/** Public site headings (Studio Groove). */
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", style: ["normal", "italic"], axes: ["opsz"] });
/** Public site accents: wordmark, small labels, the service strip. */
const shrikhand = Shrikhand({ subsets: ["latin"], weight: "400", variable: "--font-shrikhand", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Haircraft360 · Loc care in Ibadan",
    template: "%s · Haircraft360",
  },
  description:
    "Book loc care in Ibadan online: starter locs, retwists and more. Choose your services and time, and reserve with a deposit.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/logo-pink-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#fdfafc",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG" className={`${playfair.variable} ${montserrat.variable} ${fraunces.variable} ${shrikhand.variable}`}>
      <body className="min-h-dvh">
        {isStaging() && <StagingMark />}
        {children}
      </body>
    </html>
  );
}
