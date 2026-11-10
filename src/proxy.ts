import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic admin gate (DEMO). Redirects visitors without a session cookie.
 * The real check — signature + expiry — runs server-side in requireAdmin()
 * on every admin page and server action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  if (!request.cookies.has("hc360_demo_admin")) {
    const url = new URL("/admin/login", request.url);
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
