"use client";

import { useState, useTransition } from "react";
import { Check, MessageCircle } from "lucide-react";
import { whatsappSentAction } from "@/app/admin/actions";
import { Button, buttonClass } from "@/components/ui/primitives";

/**
 * Two separate steps, so the list only ever shows what was really sent:
 * 1. "Open in WhatsApp" opens the chat with the message filled in. It changes nothing here.
 * 2. "Mark as sent", pressed by the owner once the message has gone, takes it off the list.
 * After opening, Mark as sent becomes the main button as a prompt.
 */
export function WhatsappSend({ notificationId, href, name }: { notificationId: string; href: string; name: string }) {
  const [opened, setOpened] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)} className={buttonClass(opened ? "secondary" : "primary", "md")}>
          <MessageCircle aria-hidden className="size-4" /> Open in WhatsApp
          <span className="sr-only"> (opens WhatsApp for {name})</span>
        </a>
        <Button
          variant={opened ? "primary" : "secondary"}
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await whatsappSentAction(notificationId);
              if (r?.error) setError(r.error);
            })
          }
        >
          <Check aria-hidden className="size-4" /> Mark as sent
          <span className="sr-only"> for {name}</span>
        </Button>
      </div>
      {opened && !error && <p className="text-xs text-ink-3">Sent it in WhatsApp? Mark it as sent.</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
