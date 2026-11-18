"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { Booking, Kobo } from "@/domain/types";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import {
  bookingNoteAction,
  completeBookingAction,
  customerNoteAction,
  manualPaymentAction,
  setStatusAction,
  type ActionState,
} from "@/app/admin/actions";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button, Field, cx, inputClass } from "@/components/ui/primitives";

const Feedback = ActionFeedback;

/* ───────────── Completion: add anything done on the day, then mark completed ───────────── */

export function CompletionForm({ booking, paidKobo }: { booking: Booking; paidKobo: Kobo }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(completeBookingAction.bind(null, booking.id), null);
  const completed = booking.status === "completed";
  const [extras, setExtras] = useState<{ key: string; name: string; price: string; note: string }[]>([]);
  const added = useMemo(() => extras.reduce((sum, e) => sum + (parseNairaToKobo(e.price) ?? 0), 0), [extras]);
  const newTotal = booking.totalKobo + added;
  const fe = state?.fieldErrors ?? {};

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setExtras([]);
      }}
      className="space-y-5"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Anything added on the day?</legend>
        <p className="mb-3 text-sm text-ink-3">Add services or products done on top of the booking. Prices here are added to the total.</p>
        <ul className="space-y-2">
          {extras.map((x, i) => (
            <li key={x.key} className="grid gap-2 rounded-[var(--radius)] border border-line p-3 sm:grid-cols-[1fr_8rem_auto]">
              <input name="extraName" value={x.name} onChange={(e) => setExtras(extras.map((y) => (y.key === x.key ? { ...y, name: e.target.value } : y)))} placeholder="For example, loc oil (product)" aria-label={`Extra ${i + 1} name`} className={cx(inputClass, "text-sm")} />
              <input name="extraPrice" inputMode="decimal" value={x.price} onChange={(e) => setExtras(extras.map((y) => (y.key === x.key ? { ...y, price: e.target.value } : y)))} placeholder="₦" aria-label={`Extra ${i + 1} price in naira`} className={cx(inputClass, "tabular text-right text-sm")} />
              <button type="button" onClick={() => setExtras(extras.filter((y) => y.key !== x.key))} className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] px-3 text-danger hover:bg-danger-soft">
                <Trash2 aria-hidden className="size-4" /><span className="sr-only">Remove extra {i + 1}</span>
              </button>
              <input name="extraNote" value={x.note} onChange={(e) => setExtras(extras.map((y) => (y.key === x.key ? { ...y, note: e.target.value } : y)))} placeholder="Note (optional)" aria-label={`Extra ${i + 1} note`} className={cx(inputClass, "min-h-9 py-1.5 text-sm sm:col-span-3")} />
              {fe[`extra_${i}`] && <p className="text-xs text-danger sm:col-span-3">{fe[`extra_${i}`]}</p>}
            </li>
          ))}
        </ul>
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setExtras([...extras, { key: crypto.randomUUID(), name: "", price: "", note: "" }])}>
          <Plus aria-hidden className="size-4" /> Add an item
        </Button>
      </fieldset>

      <dl className="space-y-1 rounded-[var(--radius)] bg-sand/60 p-4 text-sm">
        <div className="flex justify-between"><dt className="text-ink-2">Total{added ? " after these additions" : ""}</dt><dd className="tabular">{formatNaira(newTotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-2">Paid so far</dt><dd className="tabular">{formatNaira(paidKobo)}</dd></div>
        <div className="flex justify-between border-t border-line-strong pt-1 font-semibold"><dt>Balance due</dt><dd className="tabular">{formatNaira(Math.max(newTotal - paidKobo, 0))}</dd></div>
        {paidKobo > newTotal && <p className="pt-1 text-xs text-warning">Payments are {formatNaira(paidKobo - newTotal)} more than the total. Sort this out with the customer directly.</p>}
      </dl>

      <Feedback state={state} />
      <Button type="submit" size="lg" loading={pending}>
        <Check aria-hidden className="size-4" /> {completed ? "Save additions" : "Mark completed"}
      </Button>
    </form>
  );
}

/* ───────────── Private notes ───────────── */

export function PrivateNoteForm({ kind, id, defaultValue }: { kind: "booking" | "customer"; id: string; defaultValue: string }) {
  const fn = kind === "booking" ? bookingNoteAction.bind(null, id) : customerNoteAction.bind(null, id);
  const [state, action, pending] = useActionState<ActionState, FormData>(fn, null);
  const name = kind === "booking" ? "privateNote" : "privateNotes";
  return (
    <form action={action} className="space-y-3">
      <label htmlFor={`${kind}-note`} className="sr-only">Private {kind} note</label>
      <textarea id={`${kind}-note`} name={name} rows={4} defaultValue={defaultValue} placeholder="Only visible to salon admins." className={cx(inputClass, "min-h-24 text-sm")} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="night" loading={pending}>Save note</Button>
        {state?.ok && <span role="status" className="flex items-center gap-1 text-sm text-success"><Check aria-hidden className="size-4" /> Saved</span>}
        {state?.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

/* ───────────── Manual payment ───────────── */

export function ManualPaymentForm({ bookingId, awaitingDeposit }: { bookingId: string; awaitingDeposit: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(manualPaymentAction.bind(null, bookingId), null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="mp-amount" label="Amount (₦)" error={state?.fieldErrors?.amount}>
          <input id="mp-amount" name="amount" inputMode="decimal" required className={cx(inputClass, "tabular")} />
        </Field>
        <Field id="mp-method" label="Received by" error={state?.fieldErrors?.method}>
          <select id="mp-method" name="method" className={inputClass} defaultValue="transfer">
            <option value="transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="card">Card (POS)</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field id="mp-purpose" label="Towards">
          <select id="mp-purpose" name="purpose" className={inputClass} defaultValue={awaitingDeposit ? "deposit" : "balance"}>
            {awaitingDeposit && <option value="deposit">Deposit (confirms the booking)</option>}
            <option value="balance">Balance</option>
          </select>
        </Field>
      </div>
      <Field id="mp-note" label="Note" optional>
        <input id="mp-note" name="note" className={cx(inputClass, "text-sm")} />
      </Field>
      <p className="text-xs text-ink-3">Saved with your name and the time. Payments are never edited; record a correction if something was wrong.</p>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" size="sm" loading={pending}>Record payment</Button>
    </form>
  );
}

/* ───────────── Status changes ───────────── */

export function StatusActions({ bookingId, status }: { bookingId: string; status: Booking["status"] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState>(null);
  const run = (to: "cancelled" | "no_show" | "confirmed", confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    start(async () => setMsg(await setStatusAction(bookingId, to)));
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "confirmed" && (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => run("no_show", "Mark this booking as a no-show? Payments already received are kept.")}>
            Mark no-show
          </Button>
        )}
        {(status === "confirmed" || status === "pending_payment" || status === "needs_attention") && (
          <Button variant="danger" size="sm" disabled={pending} onClick={() => run("cancelled", "Cancel this booking? The time will be released. Deposits are not refunded automatically.")}>
            Cancel booking
          </Button>
        )}
        {(status === "cancelled" || status === "no_show") && (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => run("confirmed", "Reinstate this booking as confirmed?")}>
            Reinstate
          </Button>
        )}
      </div>
      {msg?.error && <p role="alert" className="text-sm text-danger">{msg.error}</p>}
    </div>
  );
}

/* ───────────── Balance payment link ───────────── */

/** Placeholder until Milestone 4 adds payment links sent by WhatsApp. */
export function BalanceLink() {
  return <p className="text-sm text-ink-3">Payment links sent by WhatsApp arrive with online payments. For now, record cash or transfer payments above.</p>;
}
