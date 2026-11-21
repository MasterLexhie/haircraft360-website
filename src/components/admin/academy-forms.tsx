"use client";

import { useActionState, useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { APPLICATION_STATUSES, MAX_OUTCOMES, applicationStatusLabel, type ApplicationStatus } from "@/domain/academy";
import { applicationNoteAction, applicationStatusAction, programAction, type ActionState } from "@/app/admin/actions";
import type { ProgramRow } from "@/server/academy";
import { formatNaira, koboToInput } from "@/lib/money";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { Badge, Button, Field, cx, inputClass } from "@/components/ui/primitives";

/** onSubmit rather than <form action>, so a refused save keeps what was typed. */
function useSubmit(action: (data: FormData) => void) {
  const [, start] = useTransition();
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(() => action(data));
  };
}

/* ───────────── Application status and note ───────────── */

export function ApplicationStatusForm({ id, status }: { id: string; status: ApplicationStatus }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(applicationStatusAction.bind(null, id), null);
  const [value, setValue] = useState(status);
  const onSubmit = useSubmit(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <fieldset>
        <legend className="sr-only">Application status</legend>
        <div className="grid gap-2">
          {APPLICATION_STATUSES.map((s) => (
            <label
              key={s}
              className={cx(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius)] border px-3 py-2.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink",
                value === s ? "border-accent bg-accent-soft/40" : "border-line hover:border-line-strong",
              )}
            >
              <input type="radio" name="status" value={s} checked={value === s} onChange={() => setValue(s)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
              <span>
                <span className="block font-semibold text-ink">{applicationStatusLabel[s].label}</span>
                <span className="block text-xs text-ink-3">{applicationStatusLabel[s].help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <ActionFeedback state={state} />
      <Button type="submit" size="sm" loading={pending} disabled={value === status}>
        Save status
      </Button>
    </form>
  );
}

export function ApplicationNoteForm({ id, defaultValue }: { id: string; defaultValue: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(applicationNoteAction.bind(null, id), null);
  const onSubmit = useSubmit(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="application-note" className="sr-only">Private note</label>
      <textarea id="application-note" name="privateNote" rows={4} maxLength={2000} defaultValue={defaultValue} placeholder="Only visible to salon admins. For example, what you discussed on the call." className={cx(inputClass, "min-h-24 text-sm")} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="night" loading={pending}>Save note</Button>
        {state?.ok && (
          <span role="status" className="flex items-center gap-1 text-sm text-success">
            <Check aria-hidden className="size-4" /> Saved
          </span>
        )}
        {state?.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

/* ───────────── Programs (Settings) ───────────── */

export function ProgramsManager({ programs }: { programs: ProgramRow[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const done = useCallback((msg?: string) => {
    setEditing(null);
    setMessage(msg ?? null);
  }, []);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          The programs on the <a href="/locs-mastery" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Locs Mastery page</a>. Each program can show its fee; leave it blank to discuss the fee with each applicant instead.
        </p>
        {editing !== "new" && (
          <Button variant="secondary" size="sm" onClick={() => { setMessage(null); setEditing("new"); }}>
            <Plus aria-hidden className="size-4" /> Add a program
          </Button>
        )}
      </div>
      {message && <p role="status" className="flex items-center gap-1.5 text-sm text-success"><Check aria-hidden className="size-4" /> {message}</p>}
      {editing === "new" && <ProgramForm onDone={done} />}
      {programs.length === 0 && editing !== "new" ? (
        <p className="rounded-[var(--radius)] border border-dashed border-line-strong p-6 text-center text-sm text-ink-2">No programs yet. Add one to show it on the page.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius)] border border-line bg-surface">
          {programs.map((p) => (
            <li key={p.id} className="p-4">
              {editing === p.id ? (
                <ProgramForm program={p} onDone={done} />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{p.name}</p>
                    <p className="text-sm text-ink-3">
                      {p.duration}
                      {p.level ? ` · ${p.level}` : ""} · {p.priceKobo === null ? "fee not shown" : formatNaira(p.priceKobo)} · {p.outcomes.length} {p.outcomes.length === 1 ? "thing" : "things"} to learn · {p.applicationCount}{" "}
                      {p.applicationCount === 1 ? "application" : "applications"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.active ? <Badge tone="success">On the page</Badge> : <Badge tone="neutral">Hidden</Badge>}
                      {p.active && (p.acceptingApplications ? <Badge tone="info">Taking applications</Badge> : <Badge tone="warning">Applications closed</Badge>)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setMessage(null); setEditing(p.id); }}>
                    <Pencil aria-hidden className="size-4" /> Edit
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProgramForm({ program, onDone }: { program?: ProgramRow; onDone: (message?: string) => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(programAction.bind(null, program?.id ?? null), null);
  const onSubmit = useSubmit(action);
  const fe = state?.fieldErrors ?? {};
  const pre = program?.id ?? "new";
  // Close once saved; the list shows the confirmation.
  useEffect(() => {
    if (state?.ok) onDone(state.message);
  }, [state, onDone]);
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-[var(--radius)] border border-accent/40 bg-surface p-4">
      <Field id={`${pre}-name`} label="Program name" required error={fe.name}>
        <input id={`${pre}-name`} name="name" defaultValue={program?.name} maxLength={80} autoFocus className={cx(inputClass, "text-sm")} />
      </Field>
      <Field id={`${pre}-summary`} label="Short description" required hint="Who it's for and what it leads to, in a sentence or two." error={fe.summary}>
        <textarea id={`${pre}-summary`} name="summary" rows={2} maxLength={400} defaultValue={program?.summary} className={cx(inputClass, "min-h-16 text-sm")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${pre}-duration`} label="Length" required hint="For example 6 weeks" error={fe.duration}>
          <input id={`${pre}-duration`} name="duration" defaultValue={program?.duration} maxLength={40} className={cx(inputClass, "text-sm")} />
        </Field>
        <Field id={`${pre}-level`} label="Level" optional hint="For example Beginners" error={fe.level}>
          <input id={`${pre}-level`} name="level" defaultValue={program?.level} maxLength={80} className={cx(inputClass, "text-sm")} />
        </Field>
        <Field id={`${pre}-format`} label="Where and when" optional hint="For example Saturdays in the salon" error={fe.format}>
          <input id={`${pre}-format`} name="format" defaultValue={program?.format} maxLength={120} className={cx(inputClass, "text-sm")} />
        </Field>
      </div>
      <Field id={`${pre}-price`} label="Program fee" optional hint="Shown on the page. Leave blank to discuss the fee with each applicant." error={fe.price}>
        <span className="relative block max-w-xs">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">₦</span>
          <input id={`${pre}-price`} name="price" inputMode="decimal" defaultValue={koboToInput(program?.priceKobo ?? null)} placeholder="For example 150000" className={cx(inputClass, "pl-8 text-sm tabular")} />
        </span>
      </Field>
      <Field id={`${pre}-outcomes`} label="What students learn" required hint={`One per line, up to ${MAX_OUTCOMES}.`} error={fe.outcomes}>
        <textarea id={`${pre}-outcomes`} name="outcomes" rows={5} defaultValue={program?.outcomes.join("\n")} className={cx(inputClass, "min-h-28 text-sm")} />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={program?.active ?? true} className="size-4 accent-[var(--color-accent)]" />
          Show on the page
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="acceptingApplications" defaultChecked={program?.acceptingApplications ?? true} className="size-4 accent-[var(--color-accent)]" />
          Taking applications
        </label>
      </div>
      <ActionFeedback state={state?.ok ? null : state} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>{program ? "Save program" : "Add program"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDone()}>Cancel</Button>
      </div>
    </form>
  );
}
