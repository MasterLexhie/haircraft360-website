import type { Metadata } from "next";
import { Suspense } from "react";
import QRCode from "qrcode";
import { beginTotpSetup } from "@/server/auth";
import { Skeleton } from "@/components/ui/primitives";
import { AuthCard } from "../auth-card";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up sign-in codes", robots: { index: false, follow: false } };

/** First sign-in: the admin links an authenticator app before reaching the admin. Required for everyone. */
export default function SetupPage() {
  return (
    <AuthCard wide title="Protect your account" subtitle="Each sign-in will ask for a code from an app on your phone, so a stolen password alone can't open the admin.">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Setup />
      </Suspense>
    </AuthCard>
  );
}

async function Setup() {
  const setup = await beginTotpSetup();
  if (setup === "done") return <SetupForm done qrSvg="" secret="" />;
  const svg = await QRCode.toString(setup.uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return <SetupForm done={false} qrSvg={svg} secret={setup.secret.replace(/(.{4})/g, "$1 ").trim()} />;
}
