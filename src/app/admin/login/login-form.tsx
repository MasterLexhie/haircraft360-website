"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type AuthState } from "../auth-actions";
import { Alert, Button, Field, inputClass } from "@/components/ui/primitives";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, null);
  const next = useSearchParams().get("next") ?? "";
  // Controlled, so a failed attempt keeps the email (React resets uncontrolled fields after an action).
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert tone="danger" role="alert" title={state.error} />}
      <Field id="email" label="Email">
        <input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <Field id="password" label="Password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Continue</Button>
      <p className="text-center text-xs text-ink-3">Forgotten your password? Contact your developer to reset it.</p>
    </form>
  );
}
