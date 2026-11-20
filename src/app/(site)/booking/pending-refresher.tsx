"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 5_000;
const FOR_MS = 2 * 60_000;

/**
 * While a booking awaits its deposit, re-reads the page now and then. A customer paying by
 * transfer leaves for their bank app, and the webhook may confirm the booking while they are
 * away; coming back to the tab shows it without a manual refresh. Reads our own records only.
 */
export function PendingRefresher() {
  const router = useRouter();
  useEffect(() => {
    let until = Date.now() + FOR_MS;
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() < until) router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      until = Date.now() + FOR_MS;
      router.refresh();
    };
    const timer = setInterval(tick, EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return null;
}
