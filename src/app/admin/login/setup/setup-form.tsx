"use client";

import { useActionState } from "react";
import { confirmSetupAction, type AuthState } from "../../auth-actions";
import { Alert, Button, ButtonLink, Field, inputClass } from "@/components/ui/primitives";
import { BackupCodes } from "@/components/admin/backup-codes";

export function SetupForm({ qrSvg, secret, done }: { qrSvg: string; secret: string; done: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(confirmSetupAction, null);

  if (state?.backupCodes) {
    return (
      <div className="space-y-5">
        <Alert tone="success" title="Sign-in codes are on" />
        <BackupCodes codes={state.backupCodes} />
        <ButtonLink href="/admin" size="lg" className="w-full">I&apos;ve saved them. Continue</ButtonLink>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5">
        <Alert tone="success" title="Sign-in codes are already on for this account" />
        <ButtonLink href="/admin" size="lg" className="w-full">Go to the admin</ButtonLink>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <ol className="list-decimal space-y-3 pl-5 text-sm text-ink-2">
        <li>Install an authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator.</li>
        <li>In the app, add an account and scan this code.</li>
      </ol>
      {/* Generated on the server by the qrcode library from our own data. */}
      <div className="mx-auto w-48 rounded-[var(--radius)] border border-line bg-white p-2" aria-label="QR code for your authenticator app" role="img" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-ink-2">Can&apos;t scan? Type this key instead</summary>
        <p className="mt-2 break-all rounded-[var(--radius)] bg-sand p-3 text-center font-mono tracking-wider">{secret}</p>
      </details>
      {state?.error && <Alert tone="danger" role="alert" title={state.error} />}
      <Field id="code" label="3. Enter the 6-digit code the app shows">
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className={`${inputClass} text-center text-2xl tabular tracking-[0.3em]`} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Turn on sign-in codes</Button>
    </form>
  );
}
