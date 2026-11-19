import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "./auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <AuthCard title="Salon admin" subtitle="Bookings, customers and payments">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
