import "server-only";
import { after } from "next/server";
import { sendDueNotifications } from "./notifications";

/**
 * Sends messages that are already due straight after this response, so a booking
 * confirmation or an application receipt goes out within seconds instead of waiting for
 * the hourly cron run, which stays as the backstop for anything this misses. Safe to call
 * often: each message is claimed before sending, so nothing goes out twice.
 */
export function sendDueSoon(): void {
  after(async () => {
    try {
      await sendDueNotifications({ deadlineMs: Date.now() + 10_000 });
    } catch (err) {
      console.error(`[notifications] immediate send failed, the hourly run will retry: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}
