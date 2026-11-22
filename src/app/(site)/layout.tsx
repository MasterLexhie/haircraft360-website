import { SiteFooter } from "@/components/site/site-chrome";
import { SiteHeader } from "@/components/site/site-header";

/** Public site. `data-site` switches on the Studio Groove tokens (globals.css) for every page in here. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-site className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-on-night focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
