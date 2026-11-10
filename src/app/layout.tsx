import type { Metadata, Viewport } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  style: ["normal", "italic"],
});
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Haircraft360 · Loc care in Ibadan (prototype)",
    template: "%s · Haircraft360",
  },
  description:
    "Prototype website for Haircraft360, a loc-focused hair business in Ibadan. Demo services and simulated payments only.",
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
    <html lang="en-NG" className={`${playfair.variable} ${montserrat.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
