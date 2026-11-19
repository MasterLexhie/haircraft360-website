"use client";

import { useActionState, useState, useTransition } from "react";
import { changePasswordAction, regenerateBackupCodesAction, signOutEverywhereAction, type AuthState } from "../../auth-actions";
import { BackupCodes } from "@/components/admin/backup-codes";
import { Alert, Button, Field, inputClass } from "@/components/ui/primitives";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(changePasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="danger" role="alert" title={state.error} />}
      {state?.ok && <Alert tone="success" role="status" title={state.message ?? "Saved."} />}
      <Field id="current" label="Current password">
        <input id="current" name="current" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Field id="next" label="New password" hint="At least 12 characters. A short sentence is easy to remember and hard to guess.">
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required aria-describedby="next-hint" className={inputClass} />
      </Field>
      <Field id="confirm" label="New password again">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required className={inputClass} />
      </Field>
      <Button type="submit" loading={pending}>Change password</Button>
    </form>
  );
}

export function BackupCodesPanel({ left }: { left: number }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<AuthState>(null);
  if (state?.backupCodes) return <BackupCodes codes={state.backupCodes} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        You have {left} unused backup code{left === 1 ? "" : "s"}. Making new ones stops the old ones working.
      </p>
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={() => {
          if (window.confirm("Make new backup codes? Your old codes will stop working.")) start(async () => setState(await regenerateBackupCodesAction()));
        }}
      >
        Make new backup codes
      </Button>
    </div>
  );
}

export function SignOutEverywhere() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size="sm"
      loading={pending}
      onClick={() => {
        if (window.confirm("Sign out on every device, including this one?")) start(() => signOutEverywhereAction());
      }}
    >
      Sign out everywhere
    </Button>
  );
}
