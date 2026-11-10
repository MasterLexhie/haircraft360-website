"use client";

import { useActionState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { loginAction, type ActionState } from "../actions";
import { Alert, Button, Field, inputClass } from "@/components/ui/primitives";
import { DEMO_ADMIN } from "@/mock/demo-config";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, null);
  const next = useSearchParams().get("next") ?? "";
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert tone="danger" role="alert" title={state.error} />}
      <Field id="email" label="Email">
        <input ref={email} id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
      </Field>
      <Field id="password" label="Password">
        <input ref={password} id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Sign in</Button>
      <div className="rounded-[var(--radius)] border border-dashed border-line-strong bg-sand/60 p-4 text-sm">
        <p className="font-semibold text-ink">Reviewing the prototype?</p>
        <p className="mt-1 text-ink-2">Demo credentials are in <code className="rounded bg-surface px-1">src/mock/demo-config.ts</code>, or fill them in here.</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => {
            if (email.current) email.current.value = DEMO_ADMIN.email;
            if (password.current) password.current.value = DEMO_ADMIN.password;
          }}
        >
          <KeyRound aria-hidden className="size-4" /> Fill demo credentials
        </Button>
      </div>
    </form>
  );
}
