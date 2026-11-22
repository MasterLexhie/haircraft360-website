"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { Plus, RotateCcw } from "lucide-react";
import type { MessageTemplates, SalonDetails } from "@/domain/settings";
import { MESSAGE_PLACEHOLDERS, fillTemplate, type MessageVars } from "@/domain/messages";
import { expenseCategoryAction, salonDetailsAction, templatesAction, type ActionState } from "@/app/admin/actions";
import type { ExpenseCategoryRow } from "@/server/expenses";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { Badge, Button, Field, cx, inputClass } from "@/components/ui/primitives";

/**
 * Submits through onSubmit rather than <form action>, so a failed save keeps what was typed
 * (React resets a form after its action runs).
 */
function useSubmit(action: (data: FormData) => void) {
  const [, start] = useTransition();
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(() => action(data));
  };
}

/* ───────────── Message wording ───────────── */

const TEMPLATE_INFO: { key: keyof MessageTemplates; label: string; help: string; rows: number }[] = [
  { key: "confirmationWhatsapp", label: "Confirmation on WhatsApp", help: "Sent by you when a customer without email books, or from the booking page.", rows: 4 },
  { key: "reminderWhatsapp", label: "Reminder on WhatsApp", help: "Sent by you the day before, from Reminders due.", rows: 3 },
  { key: "balanceLinkWhatsapp", label: "Balance payment link on WhatsApp", help: "Sent with a payment link from the booking page. Must include {link}.", rows: 3 },
  { key: "confirmationEmailIntro", label: "Confirmation email: opening line", help: "The booking details, calendar buttons and link follow automatically.", rows: 2 },
  { key: "reminderEmailIntro", label: "Reminder email: opening line", help: "The booking details and link follow automatically.", rows: 2 },
];

export function MessageTemplatesForm({ templates, defaults, sample }: { templates: MessageTemplates; defaults: MessageTemplates; sample: MessageVars }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(templatesAction, null);
  const [values, setValues] = useState(templates);
  const onSubmit = useSubmit(action);
  const fe = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <p className="text-sm text-ink-2">
        Words in curly brackets are filled in for each booking: {MESSAGE_PLACEHOLDERS.map((p) => `{${p}}`).join(", ")}.
      </p>
      {TEMPLATE_INFO.map((t) => (
        <div key={t.key} className="space-y-2 rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)] p-4">
          <Field id={`tpl-${t.key}`} label={t.label} hint={t.help} error={fe[t.key]}>
            <textarea
              id={`tpl-${t.key}`}
              name={t.key}
              rows={t.rows}
              value={values[t.key]}
              onChange={(e) => setValues({ ...values, [t.key]: e.target.value })}
              className={cx(inputClass, "min-h-20 text-sm")}
            />
          </Field>
          <p className="rounded-[var(--radius)] bg-sand/60 p-3 text-xs text-ink-2">
            <span className="font-semibold text-ink">Example: </span>
            {fillTemplate(values[t.key], sample)}
          </p>
          {values[t.key] !== defaults[t.key] && (
            <button type="button" onClick={() => setValues({ ...values, [t.key]: defaults[t.key] })} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-ink-2 underline">
              <RotateCcw aria-hidden className="size-3.5" /> Put back the suggested wording
            </button>
          )}
        </div>
      ))}
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <ActionFeedback state={state} />
          {!state && <p className="text-xs text-ink-3">Messages already sent are not changed.</p>}
        </div>
        <Button type="submit" loading={pending} className="sm:shrink-0">Save messages</Button>
      </div>
    </form>
  );
}

/* ───────────── Salon details ───────────── */

const SALON_FIELDS: { name: string; label: string; key: keyof SalonDetails; type?: string; optional?: boolean; hint?: string; inputMode?: "tel" | "email" | "url" }[] = [
  { name: "name", label: "Salon name", key: "name" },
  { name: "addressLine1", label: "Address", key: "addressLine1", optional: true },
  { name: "addressLine2", label: "Landmark or second line", key: "addressLine2", optional: true },
  { name: "city", label: "City", key: "city", optional: true },
  { name: "state", label: "State", key: "state", optional: true },
  { name: "postcode", label: "Postcode", key: "postcode", optional: true },
  { name: "phone", label: "Phone", key: "phoneE164", type: "tel", inputMode: "tel", optional: true, hint: "Shown on the site for calls." },
  { name: "whatsapp", label: "WhatsApp number", key: "whatsappE164", type: "tel", inputMode: "tel", optional: true },
  { name: "email", label: "Email", key: "email", type: "email", inputMode: "email", optional: true },
  { name: "mapsUrl", label: "Google Maps link", key: "mapsUrl", type: "url", inputMode: "url", optional: true, hint: "Open the salon in Google Maps, tap Share and paste the link." },
  { name: "instagramUrl", label: "Instagram", key: "instagramUrl", type: "url", inputMode: "url", optional: true },
  { name: "tiktokUrl", label: "TikTok", key: "tiktokUrl", type: "url", inputMode: "url", optional: true },
  { name: "facebookUrl", label: "Facebook", key: "facebookUrl", type: "url", inputMode: "url", optional: true },
];

export function SalonDetailsForm({ details, phoneDisplay }: { details: SalonDetails; phoneDisplay: { phone: string; whatsapp: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(salonDetailsAction, null);
  const onSubmit = useSubmit(action);
  const fe = state?.fieldErrors ?? {};
  const initial = (f: (typeof SALON_FIELDS)[number]) => (f.name === "phone" ? phoneDisplay.phone : f.name === "whatsapp" ? phoneDisplay.whatsapp : details[f.key]);
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <p className="text-sm text-ink-2">Shown on the website, in emails and in the calendar file customers save. Leave a field empty to hide it.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {SALON_FIELDS.map((f) => (
          <Field key={f.name} id={`salon-${f.name}`} label={f.label} optional={f.optional} hint={f.hint} error={fe[f.name]}>
            <input id={`salon-${f.name}`} name={f.name} type={f.type ?? "text"} inputMode={f.inputMode} defaultValue={initial(f)} className={cx(inputClass, "text-sm")} />
          </Field>
        ))}
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <ActionFeedback state={state} />
        </div>
        <Button type="submit" loading={pending} className="sm:shrink-0">Save salon details</Button>
      </div>
    </form>
  );
}

/* ───────────── Expense categories ───────────── */

export function ExpenseCategoriesManager({ categories }: { categories: ExpenseCategoryRow[] }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-2">The choices in the Add expense form. A hidden category stays on the expenses already filed under it.</p>
      <NewCategory />
      <ul className="divide-y divide-line rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)]">
        {categories.map((c) => (
          <li key={c.id} className="p-4">
            <CategoryRow category={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewCategory() {
  const [state, action, pending] = useActionState<ActionState, FormData>(expenseCategoryAction.bind(null, null), null);
  const [name, setName] = useState("");
  const onSubmit = useSubmit(action);
  // Clear the box once the category is added; keep it after an error so it can be corrected.
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state?.ok) setName("");
  }
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field id="cat-new" label="New category" error={state?.fieldErrors?.name}>
            <input id="cat-new" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="For example, Laundry" className={cx(inputClass, "text-sm")} />
          </Field>
        </div>
        <Button type="submit" variant="secondary" loading={pending} disabled={!name.trim()} className="shrink-0">
          <Plus aria-hidden className="size-4" /> Add
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}

function CategoryRow({ category: c }: { category: ExpenseCategoryRow }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(expenseCategoryAction.bind(null, c.id), null);
  const onSubmit = useSubmit(action);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Field id={`cat-${c.id}`} label="Name" error={state?.fieldErrors?.name}>
            <input id={`cat-${c.id}`} name="name" defaultValue={c.name} maxLength={60} className={cx(inputClass, "text-sm")} />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={c.active} className="size-4 accent-[var(--color-accent)]" />
          In the add form
        </label>
        <Button type="submit" variant="secondary" size="sm" loading={pending}>Save</Button>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
        {!c.active && <Badge tone="neutral">Hidden</Badge>}
        {c.expenseCount} {c.expenseCount === 1 ? "expense" : "expenses"}
      </p>
      <ActionFeedback state={state} />
    </form>
  );
}
