"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Undo2 } from "lucide-react";
import type { ServicePhotoRef } from "@/domain/types";
import { PhotoReadError, shrinkPhoto } from "./photo-resize";
import { Button, cx, inputClass } from "@/components/ui/primitives";

export type PhotoChange = { action: "keep" } | { action: "remove" } | { action: "set"; blob: Blob };

/**
 * The photo box on the service form: add, replace or remove the service's photo, plus a short
 * description for screen readers. The photo is shrunk here before upload; the form reads the
 * change through `onChange` and sends it with the rest of the service.
 */
export function ServicePhotoField({
  idPrefix,
  current,
  serviceName,
  error,
  onChange,
}: {
  idPrefix: string;
  current: ServicePhotoRef | null;
  serviceName?: string;
  error?: string;
  onChange: (change: PhotoChange) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [change, setChange] = useState<PhotoChange>({ action: "keep" });
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const hintId = useId();

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const update = (next: PhotoChange) => {
    setChange(next);
    onChange(next);
  };

  async function pick(file: File | undefined) {
    if (!file) return;
    setReadError(null);
    setBusy(true);
    try {
      const { blob } = await shrinkPhoto(file);
      setPreview(URL.createObjectURL(blob));
      update({ action: "set", blob });
    } catch (e) {
      setReadError(e instanceof PhotoReadError ? e.message : "Couldn't use that photo. Try another one.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const shown = change.action === "set" ? preview : change.action === "remove" ? null : current?.url ?? null;
  const message = readError ?? error;

  return (
    <fieldset className="rounded-[var(--radius)] border border-line p-4" aria-describedby={hintId}>
      <legend className="px-1 text-sm font-semibold text-ink">Photo</legend>
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] border border-line bg-sand">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local preview or our own resized photo
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden className="size-6 text-ink-3" />
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-surface/70">
              <Loader2 aria-hidden className="size-5 animate-spin text-accent" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p id={hintId} className="text-xs text-ink-3">
            {change.action === "set"
              ? "New photo ready. It's saved when you save the service."
              : change.action === "remove"
                ? "The photo will be removed when you save the service."
                : "A clear, well-lit photo of this service. JPEG, PNG or WebP; it's shrunk for the web before saving."}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              id={`${idPrefix}-photo`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus aria-hidden className="size-4" />
              {shown ? "Replace photo" : "Add photo"}
            </Button>
            {change.action !== "keep" && (
              <Button type="button" size="sm" variant="ghost" onClick={() => { setPreview(null); setReadError(null); update({ action: "keep" }); }}>
                <Undo2 aria-hidden className="size-4" /> Undo
              </Button>
            )}
            {change.action === "keep" && current && (
              <Button type="button" size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => update({ action: "remove" })}>
                <Trash2 aria-hidden className="size-4" /> Remove
              </Button>
            )}
          </div>
          {message && <p role="alert" className="text-xs text-danger">{message}</p>}
        </div>
      </div>

      {shown && (
        <div className="mt-4 space-y-1.5 border-t border-line pt-4">
          <label htmlFor={`${idPrefix}-photoAlt`} className="block text-sm font-semibold text-ink">
            Describe the photo <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <p id={`${idPrefix}-photoAlt-hint`} className="text-xs text-ink-3">
            Read aloud to people using screen readers, and seen by search engines. For example: shoulder-length locs, freshly retwisted.
            {serviceName ? ` Left blank, it reads “${serviceName}”.` : ""}
          </p>
          <input
            id={`${idPrefix}-photoAlt`}
            name="photoAlt"
            maxLength={160}
            defaultValue={current?.alt ?? ""}
            aria-describedby={`${idPrefix}-photoAlt-hint`}
            className={cx(inputClass, "h-10 min-h-10 text-sm")}
          />
        </div>
      )}
    </fieldset>
  );
}
