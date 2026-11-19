import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_PATH_HEADER, SESSION_COOKIE_NAME } from "@/server/session-cookie";

/**
 * Optimistic admin gate: visitors without a session cookie go straight to sign-in.
 * It cannot tell a valid session from a stale one; the real check (database session,
 * expiry, two-factor) runs in requireAdmin() inside every admin page and server action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const url = new URL("/admin/login", request.url);
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // Pass the page being opened to requireAdmin(), so a stale cookie still returns here after sign-in.
  // Always overwritten, so a value sent by the browser is never trusted.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_PATH_HEADER, pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
