"use client";

import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/primitives";

/**
 * Shown when a page fails. Never displays the error itself (BUILD_SPEC 6.8: no stack traces
 * to users); the reference lets the developer find the matching server log.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="type-display text-[2.2rem]">Something went wrong</h1>
        <p className="mt-3 text-ink-2">This page didn&apos;t load properly. Nothing you entered has been charged. Please try again.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => retry()}>Try again</Button>
          <ButtonLink href="/" variant="secondary">Go to the home page</ButtonLink>
        </div>
        <p className="mt-6 text-sm text-ink-3">
          Still not working? The salon&apos;s phone number is on the <Link className="font-semibold underline" href="/#visit">home page</Link>.
          {digest && <span className="mt-1 block text-xs">Reference: {digest}</span>}
        </p>
      </div>
    </div>
  );
}
