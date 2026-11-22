import type { Metadata } from "next";
import { Suspense } from "react";
import { accountSummary, requireAdmin } from "@/server/auth";
import { formatDateTime } from "@/lib/time";
import { KeyValue, PageHeader, Panel } from "@/components/admin/bits";
import { Skeleton } from "@/components/ui/primitives";
import { BackupCodesPanel, ChangePasswordForm, SignOutEverywhere } from "./account-forms";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const admin = await requireAdmin();
  const summary = await accountSummary(admin);
  return (
    <>
      <PageHeader phoneBack={{ href: "/admin/more", label: "More" }} title="Your account" description={admin.email} />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel title="Change password">
          <ChangePasswordForm />
        </Panel>
        <div className="space-y-6">
          <Panel title="Sign-in security">
            <KeyValue
              items={[
                { label: "Last sign-in", value: summary.lastLoginAt ? formatDateTime(summary.lastLoginAt) : "None yet" },
                { label: "Password changed", value: formatDateTime(summary.passwordChangedAt) },
                { label: "Signed in on", value: `${summary.activeSessions} device${summary.activeSessions === 1 ? "" : "s"}` },
                { label: "Backup codes left", value: String(summary.backupCodesLeft) },
              ]}
            />
          </Panel>
          <Panel title="Backup codes">
            <BackupCodesPanel left={summary.backupCodesLeft} />
          </Panel>
          <Panel title="Sign out everywhere">
            <p className="mb-3 text-sm text-ink-2">Use this if you think someone else has your password or a device you signed in on is lost.</p>
            <SignOutEverywhere />
          </Panel>
        </div>
      </div>
    </>
  );
}
