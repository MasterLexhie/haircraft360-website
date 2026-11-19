"use client";

import { useActionState, useState } from "react";
import { verifyAction, type AuthState } from "../../auth-actions";
import { Alert, Button, Field, inputClass } from "@/components/ui/primitives";

export function VerifyForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(verifyAction, null);
  const [backup, setBackup] = useState(false);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert tone="danger" role="alert" title={state.error} />}
      {backup ? (
        <Field id="code" label="Backup code" hint="One of the codes you saved when you set up sign-in. Each works once.">
          <input id="code" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} required aria-describedby="code-hint" className={`${inputClass} tabular uppercase tracking-[0.12em]`} />
        </Field>
      ) : (
        <Field id="code" label="6-digit code">
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus className={`${inputClass} text-center text-2xl tabular tracking-[0.3em]`} />
        </Field>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending}>Sign in</Button>
      <button type="button" onClick={() => setBackup(!backup)} className="block w-full text-center text-sm font-semibold text-ink-2 underline underline-offset-4">
        {backup ? "Use the code from my app instead" : "Lost your phone? Use a backup code"}
      </button>
    </form>
  );
}
