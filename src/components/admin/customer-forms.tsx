"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { customerTagsAction, marketingConsentAction, type ActionState } from "@/app/admin/actions";
import { MAX_TAG_LENGTH, MAX_TAGS } from "@/domain/crm";
import { Badge, Button, cx, inputClass } from "@/components/ui/primitives";

/** The owner's tags on a customer: chips to remove, a box to add, then Save. */
export function CustomerTagsForm({ customerId, initial }: { customerId: string; initial: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(customerTagsAction.bind(null, customerId), null);
  const [tags, setTags] = useState(initial);
  const [draft, setDraft] = useState("");
  const dirty = tags.join("\n") !== initial.join("\n");

  function add() {
    const tag = draft.trim().replace(/\s+/g, " ");
    if (!tag) return;
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) setTags([...tags, tag]);
    setDraft("");
  }

  return (
    <form action={action} className="space-y-3">
      {tags.map((t) => (
        <input key={t} type="hidden" name="tag" value={t} />
      ))}
      <ul className="flex flex-wrap gap-2" aria-label="Tags">
        {tags.length === 0 && <li className="text-sm text-ink-3">No tags yet.</li>}
        {tags.map((t) => (
          <li key={t}>
            <Badge tone="accent" className="gap-1 pr-1">
              {t}
              <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="inline-flex size-5 items-center justify-center rounded-full hover:bg-accent/15">
                <X aria-hidden className="size-3" />
                <span className="sr-only">Remove {t}</span>
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      {tags.length < MAX_TAGS && (
        <div className="flex gap-2">
          <label htmlFor="new-tag" className="sr-only">
            New tag
          </label>
          <input
            id="new-tag"
            value={draft}
            maxLength={MAX_TAG_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="For example VIP"
            className={cx(inputClass, "text-sm")}
          />
          <Button type="button" variant="secondary" size="sm" onClick={add} disabled={!draft.trim()}>
            <Plus aria-hidden className="size-4" /> Add
          </Button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="night" loading={pending} disabled={!dirty && !pending}>
          Save tags
        </Button>
        {state?.ok && !dirty && (
          <span role="status" className="flex items-center gap-1 text-sm text-success">
            <Check aria-hidden className="size-4" /> Saved
          </span>
        )}
        {state?.error && (
          <span role="alert" className="text-sm text-danger">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

/** Marketing messages on or off, with the current choice spelled out. */
export function MarketingConsentSwitch({ customerId, consent }: { customerId: string; consent: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-ink-2">{consent ? "Happy to receive offers" : "No marketing messages"}</span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await marketingConsentAction(customerId, !consent);
            setError(r?.error ?? null);
          })
        }
      >
        {consent ? "Turn offers off" : "Turn offers on"}
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
