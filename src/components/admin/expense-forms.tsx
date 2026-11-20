"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { expenseDeleteAction, expenseSaveAction, type ActionState } from "@/app/admin/actions";
import { paymentMethodLabel } from "@/domain/labels";
import type { PaymentMethod } from "@/domain/types";
import { koboToInput } from "@/lib/money";
import { ActionFeedback } from "@/components/admin/action-feedback";
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

/** Where "Save expense" goes after adding: the list, which shows "Expense added". */
export const EXPENSES_AFTER_ADD = "/admin/finances/expenses?added=1";

/**
 * Add an expense (no `expense`) or edit one. Built for a phone: amount first with a number
 * keypad, date defaulting to today. Adding has two buttons: "Save expense" goes back to the
 * list; "Save and add another" stays, clearing amount and note but keeping the date, category
 * and method, so several expenses go in quickly.
 */
export function ExpenseForm({ expense, categories, todayKey }: { expense?: ExpenseFormValues; categories: { id: string; name: string }[]; todayKey: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(expenseSaveAction.bind(null, expense?.id ?? null), null);
  const [intent, setIntent] = useState<"done" | "another">("done");
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const prefix = expense ? "edit" : "new";
  const [dateKey, setDateKey] = useState(expense?.dateKey ?? todayKey);
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  const [method, setMethod] = useState<PaymentMethod>(expense?.method ?? "cash");

  // Submitted by hand, not through <form action>: React resets a form after an action, and
  // that reset puts the selects back on screen while their state keeps the old choice, so the
  // next save would send the wrong values. Here only amount and note clear after adding.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    // Enter in a field submits as "Save expense".
    setIntent(submitter?.value === "another" ? "another" : "done");
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  useEffect(() => {
    if (!state?.ok || expense) return;
    if (intent === "done") {
      router.push(EXPENSES_AFTER_ADD);
      return;
    }
    if (amountRef.current) amountRef.current.value = "";
    if (noteRef.current) noteRef.current.value = "";
    amountRef.current?.focus();
  }, [state, expense, intent, router]);

  if (categories.length === 0) {
    return <p className="text-sm text-ink-2">There are no expense categories yet. Add them in Settings first.</p>;
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}-amount`} label="Amount (₦)" required error={state?.fieldErrors?.amount}>
          <input
            ref={amountRef}
            id={`${prefix}-amount`}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            defaultValue={expense ? koboToInput(expense.amountKobo) : ""}
            className={cx(inputClass, "tabular")}
          />
        </Field>
        <Field id={`${prefix}-date`} label="Date" required error={state?.fieldErrors?.date}>
          <input id={`${prefix}-date`} name="date" type="date" required max={todayKey} value={dateKey} onChange={(e) => setDateKey(e.target.value)} className={inputClass} />
        </Field>
        <Field id={`${prefix}-category`} label="Category" required error={state?.fieldErrors?.category}>
          <select id={`${prefix}-category`} name="category" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${prefix}-method`} label="Paid by" required error={state?.fieldErrors?.method}>
          <select id={`${prefix}-method`} name="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabel[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id={`${prefix}-note`} label="Note" optional error={state?.fieldErrors?.note}>
        <textarea ref={noteRef} id={`${prefix}-note`} name="note" rows={2} maxLength={500} defaultValue={expense?.note ?? ""} placeholder="For example: 2 bottles of shampoo" className={cx(inputClass, "min-h-16 text-sm")} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
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
        {/* "Save expense" success is shown on the list it goes back to; errors always show here. */}
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
              else router.push("/admin/finances/expenses");
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
