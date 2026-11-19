"use client";

import Link from "next/link";

/**
 * Last-resort error page when the root layout itself fails. It renders its own
 * document, so it uses plain inline styles rather than the site's stylesheet.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-NG">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fdfafc", color: "#2b1d2a" }}>
        <title>Something went wrong · Haircraft360</title>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "2rem", textAlign: "center" }}>
          <div style={{ maxWidth: "28rem" }}>
            <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Something went wrong</h1>
            <p style={{ marginTop: "0.75rem", lineHeight: 1.5 }}>The site didn&apos;t load properly. Nothing you entered has been charged.</p>
            <p style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => retry()} style={{ minHeight: 44, padding: "0 1.25rem", borderRadius: 999, border: 0, background: "#5b3a59", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                Try again
              </button>
              <Link href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 1.25rem", borderRadius: 999, border: "1px solid #c9b8c7", color: "inherit", fontWeight: 600, textDecoration: "none" }}>
                Home page
              </Link>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
