import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign-in (demo)" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-sand/60 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/logo-pink-full.webp" alt="Haircraft360 logo" width={569} height={571} priority className="size-24" />
          <h1 className="type-display mt-4 text-3xl">Salon admin</h1>
          <p className="mt-1 text-sm text-ink-2">Bookings, customers and payments</p>
        </div>
        <div className="rounded-[var(--radius)] border border-line bg-surface p-6 shadow-[var(--shadow-md)]">
          <p className="mb-5 flex items-start gap-2 rounded-[var(--radius)] bg-warning-soft p-3 text-xs text-warning">
            <ShieldAlert aria-hidden className="size-4 shrink-0" />
            Demo sign-in only — not production security. Use a proper identity provider before real customer data is stored.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm"><Link className="text-ink-2 underline" href="/">← Back to the public site</Link></p>
      </div>
    </div>
  );
}
