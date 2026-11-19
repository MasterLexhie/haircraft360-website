"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/** Shown once, right after the codes are created. They are stored only as hashes. */
export function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        <strong className="text-ink">Save these backup codes somewhere safe</strong> (write them down, or keep them in a password manager).
        If you lose your phone, each code lets you sign in once. They won&apos;t be shown again.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-[var(--radius)] bg-sand p-4 font-mono text-sm tabular tracking-wider">
        {codes.map((c) => (
          <li key={c} className="text-center">{c}</li>
        ))}
      </ul>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(codes.join("\n"));
            setCopied(true);
          } catch {}
        }}
      >
        {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />} {copied ? "Copied" : "Copy codes"}
      </Button>
    </div>
  );
}
