import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_PATH_HEADER, SESSION_COOKIE_NAME } from "@/server/session-cookie";
import { BOOKING_COOKIE_MAX_AGE, bookingCookieName } from "@/lib/booking-cookie";

/**
 * - /booking/<reference>?t=<token>: the token moves into a cookie and the page reloads without
 *   it, so the link's key doesn't linger in history or logs. Other parameters are kept.
 * - /admin: an optimistic gate (below).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/booking" || pathname.startsWith("/booking/")) return bookingLink(request);
  return adminGate(request);
}

function bookingLink(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  const reference = request.nextUrl.pathname.split("/")[2];
  if (!token || !reference) return NextResponse.next();
  const clean = request.nextUrl.clone();
  clean.searchParams.delete("t");
  const response = NextResponse.redirect(clean, 303);
  response.cookies.set(bookingCookieName(reference), token.slice(0, 200), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: BOOKING_COOKIE_MAX_AGE,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Optimistic admin gate: visitors without a session cookie go straight to sign-in.
 * It cannot tell a valid session from a stale one; the real check (database session,
 * expiry, two-factor) runs in requireAdmin() inside every admin page and server action.
 */
function adminGate(request: NextRequest) {
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

export const config = { matcher: ["/admin", "/admin/:path*", "/booking/:path*"] };
