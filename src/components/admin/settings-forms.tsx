"use client";

import { useActionState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import type { ChecklistItem, DayKey, Service, Settings } from "@/domain/types";
import { checklistAction, resetDemoAction, serviceAction, settingsAction, type ActionState } from "@/app/admin/actions";
import { koboToInput } from "@/lib/money";
import { WEEKDAYS } from "@/lib/time";
import { Alert, Button, Field, cx, inputClass } from "@/components/ui/primitives";

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert tone="danger" role="alert" title={state.error} />;
  if (state?.ok) return <Alert tone="success" role="status" title={state.message} />;
  return null;
}

export function OwnerChecklist({ items }: { items: ChecklistItem[] }) {
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => (
        <li key={i.id}>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 py-3">
            <input
              type="checkbox"
              defaultChecked={i.done}
              disabled={pending}
              onChange={(e) => {
                const done = e.target.checked;
                start(() => checklistAction(i.id, done));
              }}
              className="mt-1 size-5 shrink-0 accent-[var(--ink)]"
            />
            <span>
              <span className={cx("block font-medium", i.done && "text-ink-3 line-through")}>{i.label}</span>
              <span className="block text-sm text-ink-3">{i.detail}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function ServiceForm({ service }: { service?: Service }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(serviceAction, null);
  const fe = state?.fieldErrors ?? {};
  const pre = service?.id ?? "new";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={service?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${pre}-name`} label="Name" required error={fe.name}>
          <input id={`${pre}-name`} name="name" defaultValue={service?.name} className={inputClass} />
        </Field>
        <label className="flex min-h-11 items-center gap-3 self-end text-sm font-medium">
          <input type="checkbox" name="active" defaultChecked={service?.active ?? true} className="size-5 accent-[var(--ink)]" />
          Bookable online
        </label>
      </div>
      <Field id={`${pre}-description`} label="Short description">
        <textarea id={`${pre}-description`} name="description" rows={2} defaultValue={service?.description} className={cx(inputClass, "min-h-16 text-sm")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${pre}-price`} label="Price (₦)" hint="Blank = “price confirmed at appointment”" error={fe.price}>
          <input id={`${pre}-price`} name="price" inputMode="decimal" defaultValue={koboToInput(service?.priceKobo ?? null)} aria-describedby={`${pre}-price-hint`} className={cx(inputClass, "tabular")} />
        </Field>
        <Field id={`${pre}-duration`} label="Duration (minutes)" hint="Blank = default block from availability settings" error={fe.duration}>
          <input id={`${pre}-duration`} name="duration" inputMode="numeric" defaultValue={service?.durationMinutes ?? ""} aria-describedby={`${pre}-duration-hint`} className={cx(inputClass, "tabular")} />
        </Field>
      </div>
      <p className="text-xs text-ink-3">Saved services stay marked <strong>Demo</strong> in this prototype. Only the owner can approve a real menu.</p>
      <Feedback state={state} />
      <Button type="submit" size="sm" variant="night" loading={pending}>{service ? "Save service" : "Add demo service"}</Button>
    </form>
  );
}

export function AvailabilityForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(settingsAction, null);
  const fe = state?.fieldErrors ?? {};
  const a = settings.availability;
  const d = settings.deposit;
  const order: DayKey[] = [1, 2, 3, 4, 5, 6, 0];
  const num = (id: string, label: string, value: number, hint?: string) => (
    <Field id={id} label={label} hint={hint} error={fe[id]}>
      <input id={id} name={id} inputMode="numeric" defaultValue={value} aria-describedby={hint ? `${id}-hint` : undefined} aria-invalid={!!fe[id]} className={cx(inputClass, "tabular")} />
    </Field>
  );
  return (
    <form action={action} className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Sample opening hours <span className="font-normal text-ink-3">(seeded from the public listing)</span></legend>
        <div className="divide-y divide-line rounded-[var(--radius)] border border-line">
          {order.map((day) => {
            const h = a.weeklyHours[day];
            return (
              <div key={day} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 p-3 sm:grid-cols-[8rem_auto_1fr_1fr]">
                <span className="text-sm font-medium">{WEEKDAYS[day]}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`closed_${day}`} defaultChecked={!h} className="size-5 accent-[var(--ink)]" /> Closed
                </label>
                <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1">
                  <span className="w-10 text-ink-3">Opens</span>
                  <input type="time" name={`open_${day}`} defaultValue={h?.open ?? "08:00"} className={cx(inputClass, "tabular")} />
                </label>
                <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1">
                  <span className="w-10 text-ink-3">Closes</span>
                  <input type="time" name={`close_${day}`} defaultValue={h?.close ?? "21:00"} className={cx(inputClass, "tabular")} />
                </label>
                {fe[`day_${day}`] && <p className="col-span-full text-xs text-danger">{fe[`day_${day}`]}</p>}
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold">Booking rules (demo defaults)</legend>
        {num("bookingHorizonDays", "Booking horizon (days ahead)", a.bookingHorizonDays)}
        {num("pendingHoldMinutes", "Unpaid hold (minutes)", a.pendingHoldMinutes, "How long a slot is held during checkout")}
        {num("minimumLeadMinutes", "Minimum notice (minutes)", a.minimumLeadMinutes)}
        {num("slotStepMinutes", "Start-time step (minutes)", a.slotStepMinutes)}
        {num("defaultDurationMinutes", "Default duration (minutes)", a.defaultDurationMinutes, "Used when a service has no duration")}
        {num("concurrentCapacity", "Appointments at once", a.concurrentCapacity, "1 = one chair/stylist")}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Demo deposit rule</legend>
        <Field id="depositType" label="Rule type">
          <select id="depositType" name="depositType" defaultValue={d.type} className={inputClass}>
            <option value="percent">Percentage of estimate</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </Field>
        {num("depositPercent", "Percentage (%)", d.percent)}
        <Field id="depositMinimum" label="Minimum deposit (₦)" error={fe.depositMinimum}>
          <input id="depositMinimum" name="depositMinimum" inputMode="decimal" defaultValue={koboToInput(d.minimumKobo)} className={cx(inputClass, "tabular")} />
        </Field>
        <Field id="depositFixed" label="Fixed deposit (₦)" error={fe.depositFixed}>
          <input id="depositFixed" name="depositFixed" inputMode="decimal" defaultValue={koboToInput(d.fixedKobo)} className={cx(inputClass, "tabular")} />
        </Field>
      </fieldset>

      <Feedback state={state} />
      <Button type="submit" variant="night" loading={pending}>Save settings</Button>
    </form>
  );
}

export function ResetDemoButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size="sm"
      loading={pending}
      onClick={() => {
        if (window.confirm("Reset all demo data? Every booking, customer, payment and setting returns to the seeded sample state.")) {
          start(() => resetDemoAction());
        }
      }}
    >
      <RotateCcw aria-hidden className="size-4" /> Reset demo data
    </Button>
  );
}
