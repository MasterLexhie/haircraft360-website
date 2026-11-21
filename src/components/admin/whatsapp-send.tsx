"use client";

import { useState, useTransition } from "react";
import { Check, MessageCircle, MessageSquareText, Phone } from "lucide-react";
import type { ManualMessage } from "@/server/whatsapp-messages";
import { whatsappSentAction } from "@/app/admin/actions";
import { Button, buttonClass } from "@/components/ui/primitives";

/**
 * Two separate steps, so the list only ever shows what was really sent:
 * 1. Open the message: in WhatsApp, or, for a customer who said they aren't on WhatsApp, as a
 *    text message (with a Call button too). It changes nothing here.
 * 2. "Mark as sent", pressed by the owner once the message has gone, takes it off the list.
 * After opening, Mark as sent becomes the main button as a prompt.
 */
export function WhatsappSend({ message: m }: { message: Pick<ManualMessage, "id" | "name" | "whatsappUrl" | "onWhatsapp" | "smsUrl" | "telUrl"> }) {
  const [opened, setOpened] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = buttonClass(opened ? "secondary" : "primary", "md");
  return (
    <div className="flex flex-col gap-2 sm:items-end">
      {!m.onWhatsapp && <p className="text-xs text-ink-3">Not on WhatsApp, the customer said. Text or call instead.</p>}
      <div className="flex flex-wrap gap-2">
        {m.onWhatsapp ? (
          <a href={m.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)} className={open}>
            <MessageCircle aria-hidden className="size-4" /> Open in WhatsApp
            <span className="sr-only"> (opens WhatsApp for {m.name})</span>
          </a>
        ) : (
          <>
            <a href={m.smsUrl} onClick={() => setOpened(true)} className={open}>
              <MessageSquareText aria-hidden className="size-4" /> Text message
              <span className="sr-only"> to {m.name}, with the message filled in</span>
            </a>
            <a href={m.telUrl} onClick={() => setOpened(true)} className={buttonClass("secondary", "md")}>
              <Phone aria-hidden className="size-4" /> Call
              <span className="sr-only"> {m.name}</span>
            </a>
          </>
        )}
        <Button
          variant={opened ? "primary" : "secondary"}
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await whatsappSentAction(m.id);
              if (r?.error) setError(r.error);
            })
          }
        >
          <Check aria-hidden className="size-4" /> Mark as sent
          <span className="sr-only"> for {m.name}</span>
        </Button>
      </div>
      {opened && !error && <p className="text-xs text-ink-3">{m.onWhatsapp ? "Sent it in WhatsApp?" : "Texted or called them?"} Mark it as sent.</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
