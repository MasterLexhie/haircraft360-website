"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { Clock, CopyCheck, Pencil, Plus, RotateCcw, SlidersHorizontal, Wallet } from "lucide-react";
import type { ChecklistItem, DayHours, DayKey, DepositRule, Service, Settings } from "@/domain/types";
import { checklistAction, resetDemoAction, serviceAction, settingsAction, type ActionState } from "@/app/admin/actions";
import { formatNaira, koboToInput } from "@/lib/money";
import { depositFor } from "@/domain/pricing";
import { WEEKDAYS, formatDuration, parseHHMM } from "@/lib/time";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { Badge, Button, DemoTag, Field, cx, inputClass } from "@/components/ui/primitives";

const Feedback = ActionFeedback;

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

/** Inline editor for one service (or a new one). Calls onDone after a successful save or on cancel. */
function ServiceForm({ service, onDone }: { service?: Service; onDone: (message?: string) => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(serviceAction, null);
  const [, startTransition] = useTransition();
  const fe = state?.fieldErrors ?? {};
  const pre = service?.id ?? "new";

  // Close the editor once a save succeeds; the list shows the confirmation.
  useEffect(() => {
    if (state?.ok) onDone(state.message);
  }, [state, onDone]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="id" value={service?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Field id={`${pre}-name`} label="Service name" required error={fe.name}>
          <input id={`${pre}-name`} name="name" defaultValue={service?.name} autoFocus className={cx(inputClass, "h-10 min-h-10 text-sm")} />
        </Field>
        <div>
          <label htmlFor={`${pre}-price`} className="mb-1.5 block text-sm font-semibold text-ink">Price</label>
          <UnitInput id={`${pre}-price`} name="price" prefix="₦" inputMode="decimal" defaultValue={koboToInput(service?.priceKobo ?? null)} placeholder="TBC" invalid={!!fe.price} />
          {fe.price && <p id={`${pre}-price-error`} className="mt-1 text-xs text-danger">{fe.price}</p>}
        </div>
        <div>
          <label htmlFor={`${pre}-duration`} className="mb-1.5 block text-sm font-semibold text-ink">Duration</label>
          <UnitInput id={`${pre}-duration`} name="duration" suffix="min" defaultValue={service?.durationMinutes ?? ""} placeholder="Default" invalid={!!fe.duration} />
          {fe.duration && <p id={`${pre}-duration-error`} className="mt-1 text-xs text-danger">{fe.duration}</p>}
        </div>
      </div>
      <p className="-mt-2 text-xs text-ink-3">Leave price blank to show “price confirmed at appointment”. Leave duration blank to use the default appointment length.</p>

      <Field id={`${pre}-description`} label="Short description">
        <textarea id={`${pre}-description`} name="description" rows={2} defaultValue={service?.description} className={cx(inputClass, "min-h-16 text-sm")} />
      </Field>

      <label className="flex w-fit cursor-pointer items-center gap-3">
        <input type="checkbox" role="switch" name="active" defaultChecked={service?.active ?? true} className="peer sr-only" />
        <span
          aria-hidden
          className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-line-strong transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 [&>span]:translate-x-0.5 peer-checked:[&>span]:translate-x-[18px]"
        >
          <span className="size-4 rounded-full bg-surface shadow-sm transition-transform" />
        </span>
        <span className="text-sm">
          <span className="font-medium text-ink">Bookable online</span>
          <span className="block text-xs text-ink-3">Turn off to hide it from the booking page without deleting it.</span>
        </span>
      </label>

      <Feedback state={state?.error ? state : null} />
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="submit" size="sm" loading={pending}>{service ? "Save changes" : "Add service"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onDone()}>Cancel</Button>
        <span className="text-xs text-ink-3 sm:ml-auto">Saved services stay marked Demo until the owner approves the menu.</span>
      </div>
    </form>
  );
}

/**
 * Service menu: a compact table (cards on phones) with one inline editor open
 * at a time, plus "Add service". Past bookings keep their own snapshot, so
 * edits here only affect new bookings.
 */
export function ServicesManager({ services, defaultDuration }: { services: Service[]; defaultDuration: number }) {
  const [editing, setEditing] = useState<string | null>(null); // service id, "new", or null
  const [notice, setNotice] = useState<ActionState>(null);
  const sorted = [...services].sort((a, b) => a.sortOrder - b.sortOrder);
  const bookable = sorted.filter((s) => s.active).length;

  const done = useCallback((message?: string) => {
    setEditing(null);
    if (message) setNotice({ ok: true, message });
  }, []);

  const price = (s: Service) => (s.priceKobo === null ? <span className="text-ink-3">TBC</span> : formatNaira(s.priceKobo));
  const duration = (s: Service) =>
    s.durationMinutes ? formatDuration(s.durationMinutes) : <span className="text-ink-3">Default · {formatDuration(defaultDuration)}</span>;

  return (
    <section aria-labelledby="services-title" className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="services-title" className="flex items-center gap-2 text-base font-semibold text-ink">
            Service menu <DemoTag>All demo</DemoTag>
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {sorted.length} service{sorted.length === 1 ? "" : "s"} · {bookable} bookable online
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")} disabled={editing === "new"}>
          <Plus aria-hidden className="size-4" /> Add service
        </Button>
      </header>

      {notice && <ActionFeedback state={notice} className="border-b border-line px-5 py-3" />}

      {editing === "new" && (
        <div className="border-b border-line bg-sand/40 px-5 py-5">
          <p className="type-caps mb-4 text-[0.68rem] text-accent-text">New service</p>
          <ServiceForm onDone={done} />
        </div>
      )}

      <div role="table" aria-label="Services" className="text-sm">
        <div role="row" className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_5.5rem] gap-4 border-b border-line bg-sand/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3 md:grid">
          <span role="columnheader">Service</span>
          <span role="columnheader" className="text-right">Price</span>
          <span role="columnheader">Duration</span>
          <span role="columnheader">Online</span>
          <span role="columnheader" className="sr-only">Actions</span>
        </div>

        {sorted.map((s) => {
          const open = editing === s.id;
          return (
            <div key={s.id} role="rowgroup" className={cx("border-b border-line last:border-b-0", open && "bg-sand/40")}>
              <div role="row" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_5.5rem]">
                <div role="cell" className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {s.name} {s.status === "demo" && <DemoTag>Demo</DemoTag>}
                  </p>
                  {s.description && <p className="mt-0.5 line-clamp-1 text-xs text-ink-3">{s.description}</p>}
                  <p className="mt-1 text-xs tabular text-ink-2 md:hidden">
                    {price(s)} · {duration(s)} ·{" "}
                    <span className={s.active ? "font-semibold text-success" : "text-ink-3"}>{s.active ? "Bookable" : "Hidden"}</span>
                  </p>
                </div>
                <div role="cell" className="hidden text-right tabular font-medium md:block">{price(s)}</div>
                <div role="cell" className="hidden tabular md:block">{duration(s)}</div>
                <div role="cell" className="hidden md:block">
                  <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Bookable" : "Hidden"}</Badge>
                </div>
                <div role="cell" className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(open ? null : s.id)}
                    aria-expanded={open}
                    aria-controls={`edit-${s.id}`}
                    className={cx(
                      "inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-xs font-semibold transition-colors",
                      open ? "bg-accent text-on-accent" : "text-accent-text hover:bg-accent-soft",
                    )}
                  >
                    <Pencil aria-hidden className="size-3.5" />
                    {open ? "Editing" : "Edit"}
                    <span className="sr-only"> {s.name}</span>
                  </button>
                </div>
              </div>
              {open && (
                <div id={`edit-${s.id}`} className="px-5 pb-5">
                  <div className="rounded-[var(--radius)] border border-line bg-surface p-4 sm:p-5">
                    <ServiceForm service={s} onDone={done} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="border-t border-line bg-sand/30 px-5 py-3 text-xs text-ink-3">
        Editing a service never changes past bookings. Each booking keeps a snapshot of the name, price and duration it was booked with.
      </footer>
    </section>
  );
}

const SECTIONS = [
  { id: "hours", label: "Opening hours", icon: Clock },
  { id: "rules", label: "Booking rules", icon: SlidersHorizontal },
  { id: "deposit", label: "Deposit rule", icon: Wallet },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/** Which sub-tab a field error belongs to, so the form can jump there and flag it. */
function sectionOf(field: string): SectionId {
  if (field.startsWith("day_")) return "hours";
  if (field.startsWith("deposit")) return "deposit";
  return "rules";
}

/**
 * Availability & deposit: one form split into three sub-tabs. All three stay
 * mounted (inactive ones are hidden), so a single Save submits every value.
 */
export function AvailabilityForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(settingsAction, null);
  const fe = state?.fieldErrors ?? {};
  const a = settings.availability;
  const d = settings.deposit;
  const [section, setSection] = useState<SectionId>("hours");
  const [, startTransition] = useTransition();

  const errorSections = new Set(Object.keys(fe).map(sectionOf));
  // After a failed save, jump to the first sub-tab that has an error.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    const first = SECTIONS.find((s) => errorSections.has(s.id));
    if (first) setSection(first.id);
  }

  const openDays = Object.values(a.weeklyHours).filter(Boolean).length;
  const summary: Record<SectionId, string> = {
    hours: `${openDays} day${openDays === 1 ? "" : "s"} a week`,
    rules: `${a.bookingHorizonDays}-day window · ${a.slotStepMinutes}-min slots`,
    deposit: d.type === "percent" ? `${d.percent}% · min ${formatNaira(d.minimumKobo)}` : `${formatNaira(d.fixedKobo)} fixed`,
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = SECTIONS.findIndex((s) => s.id === section);
    const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? i + 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = SECTIONS[(next + SECTIONS.length) % SECTIONS.length];
    setSection(target.id);
    document.getElementById(`subtab-${target.id}`)?.focus();
  };

  return (
    <form
      // Submit manually instead of <form action>: React resets a form after an
      // action runs, which would wipe what the owner typed when a save is rejected.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface"
    >
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="border-b border-line bg-sand/40 lg:border-b-0 lg:border-r">
          <div className="hidden items-center gap-2 px-5 pb-2 pt-5 lg:flex">
            <span className="type-caps text-[0.66rem] text-ink-3">Sections</span>
            <DemoTag>Demo values</DemoTag>
          </div>
          <div
            role="tablist"
            aria-label="Availability and deposit sections"
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
            className="grid grid-cols-3 gap-1 p-2 lg:flex lg:flex-col lg:p-3 lg:pt-1"
          >
            {SECTIONS.map((s) => {
              const active = s.id === section;
              const hasError = errorSections.has(s.id);
              return (
                <button
                  key={s.id}
                  id={`subtab-${s.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`subpanel-${s.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setSection(s.id)}
                  className={cx(
                    "group relative flex flex-col items-center gap-1.5 rounded-[var(--radius)] px-1.5 py-2 text-center transition-colors lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-left",
                    active ? "bg-surface shadow-[var(--shadow-sm)] ring-1 ring-line" : "hover:bg-surface/70",
                  )}
                >
                  <span
                    className={cx(
                      "grid size-8 shrink-0 place-items-center rounded-full transition-colors",
                      active ? "bg-accent text-on-accent" : "bg-surface text-ink-3 ring-1 ring-line group-hover:text-ink",
                    )}
                  >
                    <s.icon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={cx("block text-xs font-semibold leading-tight lg:whitespace-nowrap lg:text-sm", active ? "text-accent-text" : "text-ink-2")}>{s.label}</span>
                    <span className="hidden text-xs leading-snug text-ink-3 lg:block">{summary[s.id]}</span>
                  </span>
                  {hasError && (
                    <span className="absolute right-2 top-2 inline-flex items-center text-xs font-semibold text-danger lg:static lg:ml-auto">
                      <span aria-hidden className="size-2 rounded-full bg-danger" />
                      <span className="sr-only">has errors</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-7">
          <div role="tabpanel" id="subpanel-hours" aria-labelledby="subtab-hours" hidden={section !== "hours"}>
            <OpeningHoursEditor initial={a.weeklyHours} errors={fe} />
          </div>
          <div role="tabpanel" id="subpanel-rules" aria-labelledby="subtab-rules" hidden={section !== "rules"}>
          <SettingsGroup title="Booking rules" description="What customers can book online, and when. Demo defaults until the owner confirms.">
            <SettingRow id="bookingHorizonDays" label="Booking window" description="How far ahead customers can book." error={fe.bookingHorizonDays}>
              <UnitInput id="bookingHorizonDays" defaultValue={a.bookingHorizonDays} suffix="days" invalid={!!fe.bookingHorizonDays} />
            </SettingRow>
            <SettingRow id="minimumLeadMinutes" label="Minimum notice" description="How soon before a start time the last online booking is allowed." error={fe.minimumLeadMinutes}>
              <UnitInput id="minimumLeadMinutes" defaultValue={a.minimumLeadMinutes} suffix="min" invalid={!!fe.minimumLeadMinutes} />
            </SettingRow>
            <SettingRow id="slotStepMinutes" label="Start-time interval" description="Gap between bookable start times, e.g. 9:00, 9:30, 10:00." error={fe.slotStepMinutes}>
              <UnitInput id="slotStepMinutes" defaultValue={a.slotStepMinutes} suffix="min" invalid={!!fe.slotStepMinutes} />
            </SettingRow>
            <SettingRow id="defaultDurationMinutes" label="Default appointment length" description="Used for any service without its own duration." error={fe.defaultDurationMinutes}>
              <UnitInput id="defaultDurationMinutes" defaultValue={a.defaultDurationMinutes} suffix="min" invalid={!!fe.defaultDurationMinutes} />
            </SettingRow>
            <SettingRow id="pendingHoldMinutes" label="Unpaid slot hold" description="How long a slot stays reserved while the customer pays the deposit." error={fe.pendingHoldMinutes}>
              <UnitInput id="pendingHoldMinutes" defaultValue={a.pendingHoldMinutes} suffix="min" invalid={!!fe.pendingHoldMinutes} />
            </SettingRow>
            <SettingRow id="concurrentCapacity" label="Appointments at once" description="How many bookings can overlap. 1 means one chair or stylist." error={fe.concurrentCapacity}>
              <UnitInput id="concurrentCapacity" defaultValue={a.concurrentCapacity} suffix="at once" invalid={!!fe.concurrentCapacity} />
            </SettingRow>
          </SettingsGroup>
          </div>
          <div role="tabpanel" id="subpanel-deposit" aria-labelledby="subtab-deposit" hidden={section !== "deposit"}>
            <DepositRuleEditor deposit={d} errors={fe} />
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <Feedback state={state} />
              {!state && <p className="text-xs text-ink-3">One save covers all three sections. Existing bookings are never changed.</p>}
            </div>
            <Button type="submit" variant="primary" loading={pending} className="sm:shrink-0">Save settings</Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function SettingsGroup({ title, description, children, aside }: { title: string; description: string; children: React.ReactNode; aside?: React.ReactNode }) {
  const slug = title.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <fieldset aria-labelledby={`${slug}-title`}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h3 id={`${slug}-title`} className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-ink-3">{description}</p>
        </div>
        {aside}
      </div>
      <div className="divide-y divide-line border-y border-line">{children}</div>
    </fieldset>
  );
}

/** One setting per line: what it is on the left, the control on the right. */
function SettingRow({ id, label, description, error, children }: { id: string; label: string; description: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-2 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        <p id={`${id}-desc`} className="text-xs text-ink-3">{description}</p>
      </div>
      <div className="sm:justify-self-end">{children}</div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-danger sm:col-span-2 sm:text-right">{error}</p>}
    </div>
  );
}

function UnitInput({
  id,
  prefix,
  suffix,
  invalid,
  ...rest
}: { id: string; prefix?: string; suffix?: string; invalid?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id">) {
  return (
    <span
      className={cx(
        "flex h-10 w-40 items-center overflow-hidden rounded-[var(--radius-control)] border bg-surface text-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent",
        invalid ? "border-danger" : "border-line-strong",
      )}
    >
      {prefix && <span className="pl-3 text-ink-3" aria-hidden>{prefix}</span>}
      <input
        id={id}
        name={rest.name ?? id}
        inputMode="numeric"
        aria-invalid={invalid}
        aria-describedby={`${id}-desc${invalid ? ` ${id}-error` : ""}`}
        className="h-full min-w-0 flex-1 bg-transparent px-3 tabular text-ink focus:outline-none focus-visible:outline-none"
        {...rest}
      />
      {suffix && <span className="shrink-0 border-l border-line bg-sand/60 px-3 text-xs leading-10 text-ink-3" aria-hidden>{suffix}</span>}
    </span>
  );
}

/** Deposit rule: a two-option switch, only the fields that apply, and a live worked example. */
function DepositRuleEditor({ deposit, errors }: { deposit: Settings["deposit"]; errors: Record<string, string> }) {
  const [type, setType] = useState<"percent" | "fixed">(deposit.type);
  const [percent, setPercent] = useState(String(deposit.percent));
  const [fixed, setFixed] = useState(koboToInput(deposit.fixedKobo));
  const [minimum, setMinimum] = useState(koboToInput(deposit.minimumKobo));

  const toKobo = (v: string) => Math.round((Number(v.replace(/[^0-9.]/g, "")) || 0) * 100);
  const rule: DepositRule = { type, percent: Number(percent) || 0, fixedKobo: toKobo(fixed), minimumKobo: toKobo(minimum) };
  const examples = [1_500_000, 4_500_000]; // ₦15,000 and ₦45,000 estimates

  const options = [
    { value: "percent", label: "Percentage of estimate" },
    { value: "fixed", label: "Fixed amount" },
  ] as const;

  return (
    <SettingsGroup title="Deposit rule" description="What customers pay online to confirm a booking. Demo rule until the owner decides.">
      <div className="grid gap-x-6 gap-y-2 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p id="depositType-label" className="text-sm font-medium text-ink">Rule type</p>
          <p className="text-xs text-ink-3">Charge a share of the estimated total, or the same amount every time.</p>
        </div>
        <div role="radiogroup" aria-labelledby="depositType-label" className="inline-flex rounded-[var(--radius-control)] bg-sand p-1 sm:justify-self-end">
          {options.map((o) => (
            <label
              key={o.value}
              className={cx(
                "flex min-h-9 cursor-pointer items-center rounded-[var(--radius-control)] px-3.5 text-xs font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                type === o.value ? "bg-surface text-accent-text shadow-[var(--shadow-sm)]" : "text-ink-3 hover:text-ink",
              )}
            >
              <input type="radio" name="depositType" value={o.value} checked={type === o.value} onChange={() => setType(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      {type === "percent" ? (
        <SettingRow id="depositPercent" label="Percentage" description="Share of the estimated total paid upfront." error={errors.depositPercent}>
          <UnitInput id="depositPercent" value={percent} onChange={(e) => setPercent(e.target.value)} suffix="%" invalid={!!errors.depositPercent} />
        </SettingRow>
      ) : (
        <SettingRow id="depositFixed" label="Fixed amount" description="Charged on every booking, whatever the services." error={errors.depositFixed}>
          <UnitInput id="depositFixed" value={fixed} onChange={(e) => setFixed(e.target.value)} prefix="₦" inputMode="decimal" invalid={!!errors.depositFixed} />
        </SettingRow>
      )}
      {/* The action validates every deposit field, so keep the hidden one's value in the form. */}
      {type === "percent" ? <input type="hidden" name="depositFixed" value={fixed} /> : <input type="hidden" name="depositPercent" value={percent} />}

      <SettingRow id="depositMinimum" label="Minimum deposit" description="The deposit is never less than this (and never more than the estimate)." error={errors.depositMinimum}>
        <UnitInput id="depositMinimum" value={minimum} onChange={(e) => setMinimum(e.target.value)} prefix="₦" inputMode="decimal" invalid={!!errors.depositMinimum} />
      </SettingRow>

      <div className="py-3.5">
        <p className="text-xs font-semibold text-ink-2">Example</p>
        <ul className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
          {examples.map((est) => (
            <li key={est}>
              {formatNaira(est)} booking → <span className="font-semibold tabular text-accent-text">{formatNaira(depositFor(est, rule))}</span> deposit
            </li>
          ))}
        </ul>
      </div>
    </SettingsGroup>
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

const WEEK_ORDER: DayKey[] = [1, 2, 3, 4, 5, 6, 0];

const timeInputClass =
  "h-9 w-[8rem] rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 text-sm tabular text-ink focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-danger sm:w-[8.75rem]";

/**
 * Weekly hours as a compact schedule: one line per day with an open/closed
 * switch, a from–to time pair and the length of the day. Submits the same
 * field names the settings action already reads (closed_N, open_N, close_N).
 */
function OpeningHoursEditor({ initial, errors }: { initial: Record<DayKey, DayHours | null>; errors: Record<string, string> }) {
  const [days, setDays] = useState(() =>
    Object.fromEntries(
      WEEK_ORDER.map((d) => [d, { open: !!initial[d], from: initial[d]?.open ?? "08:00", to: initial[d]?.close ?? "21:00" }]),
    ) as Record<DayKey, { open: boolean; from: string; to: string }>,
  );
  const update = (d: DayKey, patch: Partial<{ open: boolean; from: string; to: string }>) =>
    setDays((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));

  const minutes = (d: DayKey) => {
    const { open, from, to } = days[d];
    if (!open || !from || !to) return 0;
    return Math.max(parseHHMM(to) - parseHHMM(from), 0);
  };
  const openDays = WEEK_ORDER.filter((d) => days[d].open);
  const weeklyMinutes = WEEK_ORDER.reduce<number>((sum, d) => sum + minutes(d), 0);
  const firstOpen = openDays[0];

  const copyFirstToAll = () => {
    if (firstOpen === undefined) return;
    const { from, to } = days[firstOpen];
    setDays((prev) => Object.fromEntries(WEEK_ORDER.map((d) => [d, prev[d].open ? { ...prev[d], from, to } : prev[d]])) as typeof prev);
  };

  return (
    <fieldset aria-labelledby="opening-hours-title">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h3 id="opening-hours-title" className="text-sm font-semibold text-ink">Opening hours</h3>
          <p className="mt-0.5 text-xs text-ink-3">
            Seeded from the public listing · Open {openDays.length} day{openDays.length === 1 ? "" : "s"}, {formatDuration(weeklyMinutes)} a week
          </p>
        </div>
        {firstOpen !== undefined && (
          <button
            type="button"
            onClick={copyFirstToAll}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-xs font-semibold text-accent-text hover:bg-accent-soft"
          >
            <CopyCheck aria-hidden className="size-4" />
            Use {WEEKDAYS[firstOpen]}&rsquo;s hours for all open days
          </button>
        )}
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {WEEK_ORDER.map((d) => {
          const day = days[d];
          const err = errors[`day_${d}`];
          const len = minutes(d);
          return (
            <li key={d} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[7rem_6.5rem_auto_1fr]">
              <span className={cx("text-sm font-semibold", day.open ? "text-ink" : "text-ink-3")}>{WEEKDAYS[d]}</span>

              <div className="flex items-center gap-2.5 justify-self-end sm:justify-self-start">
                <button
                  type="button"
                  role="switch"
                  aria-checked={day.open}
                  aria-label={`Open on ${WEEKDAYS[d]}`}
                  onClick={() => update(d, { open: !day.open })}
                  className={cx(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                    day.open ? "bg-accent" : "bg-line-strong",
                  )}
                >
                  <span className={cx("size-4 rounded-full bg-surface shadow-sm transition-transform", day.open ? "translate-x-[18px]" : "translate-x-0.5")} />
                </button>
                <span className={cx("w-12 text-xs font-medium", day.open ? "text-ink-2" : "text-ink-3")} aria-hidden>
                  {day.open ? "Open" : "Closed"}
                </span>
              </div>
              {!day.open && <input type="hidden" name={`closed_${d}`} value="on" />}

              <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
                {day.open ? (
                  <>
                    <input
                      type="time"
                      name={`open_${d}`}
                      value={day.from}
                      onChange={(e) => update(d, { from: e.target.value })}
                      aria-label={`${WEEKDAYS[d]} opens`}
                      aria-invalid={!!err}
                      className={timeInputClass}
                    />
                    <span className="text-xs text-ink-3" aria-hidden>to</span>
                    <input
                      type="time"
                      name={`close_${d}`}
                      value={day.to}
                      onChange={(e) => update(d, { to: e.target.value })}
                      aria-label={`${WEEKDAYS[d]} closes`}
                      aria-invalid={!!err}
                      className={timeInputClass}
                    />
                  </>
                ) : (
                  <span className="text-sm text-ink-3">No bookings this day</span>
                )}
              </div>

              <span className="hidden whitespace-nowrap pl-1 text-xs tabular text-ink-3 sm:block">{day.open && len > 0 ? formatDuration(len) : "—"}</span>

              {err && <p className="col-span-full text-xs text-danger" role="alert">{err}</p>}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
