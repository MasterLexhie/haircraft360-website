"use client";

import { useEffect, useRef, useState } from "react";
import type { ActionState } from "@/app/admin/actions";
import { Alert } from "@/components/ui/primitives";

const SUCCESS_MS = 5000;

/**
 * Result message for an admin form action. Success messages close on their
 * own after 5 seconds (paused while hovered or focused); errors stay until the
 * owner closes them or saves again. Both have a close button.
 */
export function ActionFeedback({ state, className }: { state: ActionState; className?: string }) {
  // Each new action result is a new object, so tracking it re-shows the message.
  const [dismissed, setDismissed] = useState<ActionState>(null);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visible = !!state && state !== dismissed && (!!state.error || !!state.ok);
  const isSuccess = visible && !state?.error && !!state?.ok;

  useEffect(() => {
    if (!isSuccess || paused) return;
    timer.current = setTimeout(() => setDismissed(state), SUCCESS_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isSuccess, paused, state]);

  if (!visible || !state) return null;
  return (
    <div
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {state.error ? (
        <Alert tone="danger" role="alert" title={state.error} onDismiss={() => setDismissed(state)} />
      ) : (
        <Alert tone="success" role="status" title={state.message} onDismiss={() => setDismissed(state)} />
      )}
    </div>
  );
}
