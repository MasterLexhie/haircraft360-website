import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePendingSession } from "@/server/auth";
import { Skeleton } from "@/components/ui/primitives";
import { AuthCard } from "../auth-card";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default function VerifyPage(props: Props) {
  return (
    <AuthCard title="Enter your code" subtitle="Open your authenticator app and type the 6-digit code for Haircraft 360.">
      <Suspense fallback={<Skeleton className="h-40" />}>
        <Verify {...props} />
      </Suspense>
    </AuthCard>
  );
}

async function Verify({ searchParams }: Props) {
  await requirePendingSession();
  const { next } = await searchParams;
  return <VerifyForm next={next ?? ""} />;
}
