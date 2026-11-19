"use server";

import { redirect } from "next/navigation";
import {
  AuthError,
  changePassword,
  confirmTotpSetup,
  logout,
  MIN_PASSWORD_LENGTH,
  regenerateBackupCodes,
  requireAdmin,
  signInWithPassword,
  signOutEverywhere,
  verifySecondFactor,
} from "@/server/auth";
import { z } from "zod";

export type AuthState = { error?: string; ok?: boolean; message?: string; backupCodes?: string[] } | null;

function fail(err: unknown): AuthState {
  if (err instanceof AuthError) return { error: err.message };
  throw err;
}

/** Only same-site admin paths, so ?next= can never send someone to another site. */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = String(raw ?? "");
  return next.startsWith("/admin") && !next.startsWith("//") && !next.includes("\\") && !next.startsWith("/admin/login") ? next : "/admin";
}

const loginSchema = z.object({ email: z.string().trim().max(200), password: z.string().min(1).max(500) });

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  let step: "verify" | "setup";
  try {
    step = await signInWithPassword(parsed.data.email, parsed.data.password);
  } catch (e) {
    return fail(e);
  }
  const next = safeNext(formData.get("next"));
  redirect(`/admin/login/${step}${next === "/admin" ? "" : `?next=${encodeURIComponent(next)}`}`);
}

export async function verifyAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const code = String(formData.get("code") ?? "").slice(0, 40);
  if (!code.trim()) return { error: "Enter the code from your authenticator app, or a backup code." };
  try {
    await verifySecondFactor(code);
  } catch (e) {
    return fail(e);
  }
  redirect(safeNext(formData.get("next")));
}

export async function confirmSetupAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const code = String(formData.get("code") ?? "").slice(0, 20);
  if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) return { error: "Enter the 6-digit code your app shows." };
  try {
    return { ok: true, backupCodes: await confirmTotpSetup(code) };
  } catch (e) {
    return fail(e);
  }
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

/* ───────────── Account page ───────────── */

export async function changePasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const admin = await requireAdmin();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) return { error: "The two new passwords don't match." };
  if (next.length < MIN_PASSWORD_LENGTH || next.length > 500) return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.` };
  try {
    await changePassword(admin, current, next);
    return { ok: true, message: "Password changed. Every other device has been signed out." };
  } catch (e) {
    return fail(e);
  }
}

export async function regenerateBackupCodesAction(): Promise<AuthState> {
  const admin = await requireAdmin();
  return { ok: true, backupCodes: await regenerateBackupCodes(admin) };
}

export async function signOutEverywhereAction() {
  const admin = await requireAdmin();
  await signOutEverywhere(admin);
  redirect("/admin/login");
}
