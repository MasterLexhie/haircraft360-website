"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { whatsappSentAction } from "@/app/admin/actions";
import { buttonClass } from "@/components/ui/primitives";

/**
 * Opens WhatsApp with the message filled in, and marks it sent so it leaves the list.
 * A plain link, so phones hand it straight to the WhatsApp app.
 */
export function WhatsappSend({ notificationId, href }: { notificationId: string; href: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={pending}
        className={buttonClass("primary", "md")}
        onClick={() =>
          start(async () => {
            const r = await whatsappSentAction(notificationId);
            if (r?.error) setError(r.error);
          })
        }
      >
        <MessageCircle aria-hidden className="size-4" /> {pending ? "Marking as sent…" : "Send on WhatsApp"}
        <span className="sr-only"> (opens WhatsApp)</span>
      </a>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
