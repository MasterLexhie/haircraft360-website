"use client";

import { startTransition, useActionState, useState, useTransition, type FormEvent } from "react";
import { CalendarOff, Trash2 } from "lucide-react";
import { blockAction, deleteBlockAction, type ActionState } from "@/app/admin/actions";
import type { BlockRow } from "@/server/queries";
import { describeClosurePeriod } from "@/domain/closures";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { Badge, Button, Field, cx, inputClass } from "@/components/ui/primitives";

/**
 * Closures (BUILD_SPEC Blocks): close the salon or lower capacity for a period, for example a
 * holiday or a stylist away. Existing bookings stay; the owner is told how many to contact.
 */
export function BlocksManager({ blocks, today }: { blocks: BlockRow[]; today: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(blockAction, null);
  const [wholeDay, setWholeDay] = useState(true);
  const [mode, setMode] = useState<"close" | "reduce">("close");
  const [removing, startRemoving] = useTransition();
  const [removeState, setRemoveState] = useState<ActionState>(null);
  const fe = state?.fieldErrors ?? {};

  // Submitted by hand so React doesn't reset the form natively: a native reset left the radio
  // showing "Close the salon" while the state still said "reduce". After a save, the state goes
  // back to its defaults and the form remounts, so the screen and the submitted values agree.
  const [formKey, setFormKey] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) {
      setWholeDay(true);
      setMode("close");
      setFormKey((k) => k + 1);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="add-block" className="rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)] p-5">
        <h2 id="add-block" className="text-base font-semibold">Add a closure</h2>
        <p className="mt-1 text-sm text-ink-3">For holidays, training or a stylist away. Those times stop being offered online straight away.</p>
        <form key={formKey} onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="b-start" label="First day" error={fe.startDate}>
              <input id="b-start" name="startDate" type="date" min={today} defaultValue={today} required className={inputClass} />
            </Field>
            <Field id="b-end" label="Last day" optional hint="Leave blank for one day." error={fe.endDate}>
              <input id="b-end" name="endDate" type="date" min={today} className={inputClass} aria-describedby="b-end-hint" />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" name="wholeDay" checked={wholeDay} onChange={(e) => setWholeDay(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
            <span className="font-medium">All day</span>
          </label>
          {!wholeDay && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="b-from" label="From" hint="On the first day." error={fe.from}>
                <input id="b-from" name="from" type="time" step={900} defaultValue="12:00" required className={inputClass} aria-describedby="b-from-hint" />
              </Field>
              <Field id="b-to" label="Until" hint="On the last day." error={fe.to}>
                <input id="b-to" name="to" type="time" step={900} defaultValue="15:00" required className={inputClass} aria-describedby="b-to-hint" />
              </Field>
            </div>
          )}
          <fieldset>
            <legend className="text-sm font-semibold">What happens</legend>
            <div className="mt-2 grid gap-2">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input type="radio" name="mode" value="close" checked={mode === "close"} onChange={() => setMode("close")} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
                <span><span className="font-medium">Close the salon</span><span className="block text-xs text-ink-3">No online bookings in this period.</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input type="radio" name="mode" value="reduce" checked={mode === "reduce"} onChange={() => setMode("reduce")} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
                <span><span className="font-medium">Serve fewer customers at once</span><span className="block text-xs text-ink-3">For example, one stylist away.</span></span>
              </label>
            </div>
          </fieldset>
          {mode === "reduce" && (
            <Field id="b-reduce" label="Fewer customers at once" error={fe.reduceBy}>
              <input id="b-reduce" name="reduceBy" type="number" min={1} max={20} defaultValue={1} required className={cx(inputClass, "w-28 tabular")} />
            </Field>
          )}
          <Field id="b-reason" label="Reason" optional hint="Only you see this.">
            <input id="b-reason" name="reason" maxLength={200} className={inputClass} aria-describedby="b-reason-hint" />
          </Field>
          <ActionFeedback state={state} />
          <Button type="submit" size="sm" loading={pending}>Add closure</Button>
        </form>
      </section>

      <section aria-labelledby="upcoming-blocks" className="rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)]">
        <h2 id="upcoming-blocks" className="border-b border-line px-5 py-4 text-base font-semibold">Upcoming closures</h2>
        <ActionFeedback state={removeState} className="border-b border-line px-5 py-3" />
        {blocks.length ? (
          <ul className="divide-y divide-line">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                <CalendarOff aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{describeClosurePeriod(b.startAt, b.endAt)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    <Badge tone={b.capacityReduction === null ? "danger" : "warning"}>
                      {b.capacityReduction === null ? "Closed" : `${b.capacityReduction} fewer at once`}
                    </Badge>
                    {b.reason}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removing}
                  onClick={() => {
                    if (window.confirm("Remove this closure? Those times become bookable again.")) startRemoving(async () => setRemoveState(await deleteBlockAction(b.id)));
                  }}
                >
                  <Trash2 aria-hidden className="size-4" />
                  <span className="sr-only">Remove closure: {describeClosurePeriod(b.startAt, b.endAt)}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-ink-3">No closures planned. The salon is open as per its weekly hours.</p>
        )}
      </section>
    </div>
  );
}
