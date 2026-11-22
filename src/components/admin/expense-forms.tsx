"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { expenseDeleteAction, expenseSaveAction, type ActionState } from "@/app/admin/actions";
import { paymentMethodLabel } from "@/domain/labels";
import { EXPENSES_PATH } from "@/domain/finance-nav";
import type { PaymentMethod } from "@/domain/types";
import { koboToInput, parseNairaToKobo } from "@/lib/money";
import { addDays } from "@/lib/time";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { noteExpenseAdded } from "@/components/admin/expense-toast";
import { Button, Field, cx, inputClass } from "@/components/ui/primitives";

const METHODS: PaymentMethod[] = ["cash", "transfer", "card", "other"];

export interface ExpenseFormValues {
  id: string;
  dateKey: string;
  amountKobo: number;
  categoryId: string;
  method: PaymentMethod;
  note: string;
}

const chip = (on: boolean) =>
  cx(
    "inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-lilac",
    on ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface text-ink hover:bg-sand",
  );

/**
 * Add an expense (no `expense`) or edit one. Built for a phone: the amount first, large, with
 * the number keypad open; one tap for the category and for how it was paid; the date starts on
 * today. "Save expense" returns to `back` (the Finances tab it was opened from), where an
 * "Expense added" note shows. "Save and add another" stays, clearing amount and note but
 * keeping the date, category and method, so several expenses go in quickly.
 */
export function ExpenseForm({
  expense,
  categories,
  todayKey,
  lastMethod,
  back,
}: {
  expense?: ExpenseFormValues;
  categories: { id: string; name: string }[];
  todayKey: string;
  /** How the last expense was paid: new expenses start there. */
  lastMethod?: PaymentMethod | null;
  back: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(expenseSaveAction.bind(null, expense?.id ?? null), null);
  const [intent, setIntent] = useState<"done" | "another">("done");
  const [sent, setSent] = useState<{ amountKobo: number; categoryName: string } | null>(null);
  // The answer the form had when it was last sent: the effect below acts only on a newer one,
  // so a second save never moves on with the first save's answer.
  const sentFrom = useRef<ActionState | undefined>(undefined);
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const prefix = expense ? "edit" : "new";
  const yesterdayKey = addDays(todayKey, -1);
  const [dateKey, setDateKey] = useState(expense?.dateKey ?? todayKey);
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  const startMethod = expense?.method ?? lastMethod ?? "cash";
  const [method, setMethod] = useState<PaymentMethod>(startMethod);

  // Submitted by hand, not through <form action>: React resets a form after an action, and
  // that reset puts the choices back on screen while their state keeps the old ones, so the
  // next save would send the wrong values. Here only amount and note clear after adding.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    // Enter in a field submits as "Save expense".
    setIntent(submitter?.value === "another" ? "another" : "done");
    const data = new FormData(e.currentTarget);
    sentFrom.current = state;
    setSent({ amountKobo: parseNairaToKobo(String(data.get("amount") ?? "")) ?? 0, categoryName: categories.find((c) => c.id === categoryId)?.name ?? "" });
    startTransition(() => action(data));
  }

  useEffect(() => {
    if (!state?.ok || expense || state === sentFrom.current) return;
    if (intent === "done") {
      if (state.id && sent) noteExpenseAdded({ id: state.id, ...sent });
      router.push(back);
      return;
    }
    if (amountRef.current) amountRef.current.value = "";
    if (noteRef.current) noteRef.current.value = "";
    amountRef.current?.focus();
  }, [state, expense, intent, router, back, sent]);

  if (categories.length === 0) {
    return <p className="text-sm text-ink-2">There are no expense categories yet. Add them in Settings first.</p>;
  }
  const err = state?.fieldErrors;
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor={`${prefix}-amount`} className="block text-sm font-semibold text-ink">
          Amount
        </label>
        <div className={cx("flex items-center gap-2 rounded-[var(--radius)] border bg-surface px-4 focus-within:ring-[3px] focus-within:ring-lilac", err?.amount ? "border-danger" : "border-line-strong")}>
          <span aria-hidden className="font-display text-3xl text-ink-3">₦</span>
          <input
            ref={amountRef}
            id={`${prefix}-amount`}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            autoFocus={!expense}
            placeholder="0"
            aria-invalid={!!err?.amount || undefined}
            aria-describedby={err?.amount ? `${prefix}-amount-error` : undefined}
            defaultValue={expense ? koboToInput(expense.amountKobo) : ""}
            className="h-16 min-w-0 flex-1 bg-transparent font-display text-[2rem] tabular text-ink placeholder:text-ink-3/60 focus:outline-none"
          />
        </div>
        {err?.amount && <p id={`${prefix}-amount-error`} className="text-sm text-danger">{err.amount}</p>}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-ink">Category</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className={chip(categoryId === c.id)}>
              <input type="radio" name="category" value={c.id} required checked={categoryId === c.id} onChange={() => setCategoryId(c.id)} className="sr-only" />
              {c.name}
            </label>
          ))}
        </div>
        {err?.category && <p className="text-sm text-danger">{err.category}</p>}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Date</legend>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: todayKey, label: "Today" },
              { key: yesterdayKey, label: "Yesterday" },
            ].map((d) => (
              <button key={d.label} type="button" aria-pressed={dateKey === d.key} onClick={() => setDateKey(d.key)} className={chip(dateKey === d.key)}>
                {d.label}
              </button>
            ))}
            <label className="min-w-[150px] flex-1">
              <span className="sr-only">Date</span>
              <input name="date" type="date" required max={todayKey} value={dateKey} onChange={(e) => setDateKey(e.target.value)} className={cx(inputClass, "text-sm")} />
            </label>
          </div>
          {err?.date && <p className="mt-1.5 text-sm text-danger">{err.date}</p>}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">
            Paid by
            {!expense && lastMethod && method === lastMethod && <span className="ml-2 text-xs font-normal text-ink-3">Same as last time</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <label key={m} className={chip(method === m)}>
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                {paymentMethodLabel[m]}
              </label>
            ))}
          </div>
          {err?.method && <p className="mt-1.5 text-sm text-danger">{err.method}</p>}
        </fieldset>
      </div>

      <Field id={`${prefix}-note`} label="Note" optional error={err?.note}>
        <textarea ref={noteRef} id={`${prefix}-note`} name="note" rows={2} maxLength={500} defaultValue={expense?.note ?? ""} placeholder="For example: 2 bottles of shampoo" className={cx(inputClass, "min-h-16 text-sm")} />
      </Field>

      {/* On a phone the buttons stay in reach at the bottom of the screen. */}
      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-4 py-3 max-sm:flex-col max-sm:items-stretch sm:static sm:mx-0 sm:mb-0 sm:gap-3 sm:border-0 sm:p-0">
        {expense ? (
          <Button type="submit" variant="night" loading={pending}>
            Save changes
          </Button>
        ) : (
          <>
            <Button type="submit" name="intent" value="done" variant="night" loading={pending && intent === "done"} disabled={pending}>
              Save expense
            </Button>
            <Button type="submit" name="intent" value="another" variant="secondary" loading={pending && intent === "another"} disabled={pending}>
              Save and add another
            </Button>
          </>
        )}
        {/* "Save expense" success is shown where it goes back to; errors always show here. */}
        {(expense || intent === "another" || state?.error) && <ActionFeedback state={state} />}
      </div>
    </form>
  );
}

/** Two steps, so a slip of the thumb can't delete it. Deleted expenses stay in the activity log. */
export function DeleteExpense({ id }: { id: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!asking) {
    return (
      <Button type="button" variant="secondary" onClick={() => setAsking(true)}>
        <Trash2 aria-hidden className="size-4" /> Delete expense
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-2">Delete this expense? It leaves the totals, and the activity log keeps a record.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="danger"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await expenseDeleteAction(id);
              if (r?.error) setError(r.error);
              else router.push(EXPENSES_PATH);
            })
          }
        >
          Yes, delete it
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAsking(false)} disabled={pending}>
          Keep it
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
