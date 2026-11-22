import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { bookingCookieName } from "@/lib/booking-cookie";

describe("booking link proxy", () => {
  it("moves the link token into a cookie and reloads the address without it", () => {
    const res = proxy(new NextRequest("https://salon.test/booking/hc-abc12?t=tok123&paid=deposit"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://salon.test/booking/hc-abc12?paid=deposit");
    const cookie = res.cookies.get(bookingCookieName("hc-abc12"));
    expect(cookie?.value).toBe("tok123");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(bookingCookieName("hc-abc12")).toBe("hc360_bk_HC-ABC12");
  });

  it("leaves booking pages without a token alone", () => {
    const res = proxy(new NextRequest("https://salon.test/booking/HC-ABC12?paid=deposit"));
    expect(res.headers.get("location")).toBeNull();
    expect(proxy(new NextRequest("https://salon.test/booking")).headers.get("location")).toBeNull();
  });

  it("still sends admin visitors without a session to sign-in", () => {
    const res = proxy(new NextRequest("https://salon.test/admin/bookings"));
    expect(res.headers.get("location")).toBe("https://salon.test/admin/login?next=%2Fadmin%2Fbookings");
  });
});
