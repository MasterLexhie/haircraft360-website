"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Check, Copy, Link2, Plus, Trash2 } from "lucide-react";
import type { Booking, Kobo } from "@/domain/types";
import { formatNaira, koboToInput, parseNairaToKobo } from "@/lib/money";
import {
  balanceLinkAction,
  bookingNoteAction,
  completeBookingAction,
  customerNoteAction,
  manualPaymentAction,
  setStatusAction,
  type ActionState,
} from "@/app/admin/actions";
import { Alert, Button, Field, cx, inputClass } from "@/components/ui/primitives";

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <Alert tone="danger" role="alert" title={state.error} />;
  if (state.ok) return <Alert tone="success" role="status" title={state.message} />;
  return null;
}

/* ───────────── Completion: delivered services, extras, actual total ───────────── */

export function CompletionForm({ booking, paidKobo }: { booking: Booking; paidKobo: Kobo }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(completeBookingAction.bind(null, booking.id), null);
  const booked = booking.lines.filter((l) => l.kind === "booked");
  const existingExtras = booking.lines.filter((l) => l.kind === "extra");
  const completed = booking.status === "completed";

  const [delivered, setDelivered] = useState<Record<string, boolean>>(Object.fromEntries(booked.map((l) => [l.id, completed ? l.delivered : true])));
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(booked.map((l) => [l.id, koboToInput(completed ? l.actualPriceKobo : l.estimatedPriceKobo)])),
  );
  const [extras, setExtras] = useState(
    existingExtras.length
      ? existingExtras.map((e) => ({ key: e.id, name: e.name, price: koboToInput(e.actualPriceKobo), note: e.addOnNote }))
      : [] as { key: string; name: string; price: string; note: string }[],
  );

  const suggested = useMemo(() => {
    let sum = 0;
    for (const l of booked) if (delivered[l.id]) sum += parseNairaToKobo(prices[l.id] ?? "") ?? 0;
    for (const e of extras) sum += parseNairaToKobo(e.price) ?? 0;
    return sum;
  }, [booked, delivered, prices, extras]);

  const [total, setTotal] = useState(completed && booking.actualTotalKobo !== null ? koboToInput(booking.actualTotalKobo) : "");
  const totalKobo = parseNairaToKobo(total === "" ? koboToInput(suggested) : total);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="estimateKobo" value={booking.estimatedTotalKobo} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Booked services — what was actually done?</legend>
        <ul className="divide-y divide-line rounded-[var(--radius)] border border-line">
          {booked.map((l) => (
            <li key={l.id} className="grid gap-3 p-3 sm:grid-cols-[1fr_9rem] sm:items-start">
              <input type="hidden" name="lineId" value={l.id} />
              <label className="flex min-h-11 items-start gap-3">
                <input
                  type="checkbox"
                  name={`delivered_${l.id}`}
                  checked={!!delivered[l.id]}
                  onChange={(e) => setDelivered({ ...delivered, [l.id]: e.target.checked })}
                  className="mt-1 size-5 accent-[var(--ink)]"
                />
                <span>
                  <span className="font-medium">{l.name}</span>
                  <span className="block text-xs text-ink-3">
                    Booked at {l.estimatedPriceKobo === null ? "price TBC" : formatNaira(l.estimatedPriceKobo)} (snapshot)
                  </span>
                  <input name={`note_${l.id}`} defaultValue={l.addOnNote} placeholder="Note (optional)" aria-label={`Note for ${l.name}`} className={cx(inputClass, "mt-2 min-h-9 py-1.5 text-sm")} />
                </span>
              </label>
              <div>
                <label htmlFor={`price_${l.id}`} className="text-xs font-semibold text-ink-2">Charged (₦)</label>
                <input
                  id={`price_${l.id}`}
                  name={`price_${l.id}`}
                  inputMode="decimal"
                  disabled={!delivered[l.id]}
                  value={prices[l.id]}
                  onChange={(e) => setPrices({ ...prices, [l.id]: e.target.value })}
                  aria-invalid={!!fe[`price_${l.id}`]}
                  className={cx(inputClass, "tabular text-right disabled:bg-sand disabled:text-ink-3")}
                />
                {fe[`price_${l.id}`] && <p className="mt-1 text-xs text-danger">{fe[`price_${l.id}`]}</p>}
              </div>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Extras and products used</legend>
        {extras.length === 0 && <p className="mb-2 text-sm text-ink-3">None added.</p>}
        <ul className="space-y-2">
          {extras.map((x, i) => (
            <li key={x.key} className="grid gap-2 rounded-[var(--radius)] border border-line p-3 sm:grid-cols-[1fr_8rem_auto]">
              <input name="extraName" value={x.name} onChange={(e) => setExtras(extras.map((y) => (y.key === x.key ? { ...y, name: e.target.value } : y)))} placeholder="e.g. Loc oil (product)" aria-label={`Extra ${i + 1} name`} className={cx(inputClass, "text-sm")} />
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
          <Plus aria-hidden className="size-4" /> Add extra
        </Button>
      </fieldset>

      <div className="grid gap-4 rounded-[var(--radius)] bg-sand/60 p-4 sm:grid-cols-2">
        <Field id="actualTotal" label="Actual total charged (₦)" required hint={`Suggested from the lines above: ${formatNaira(suggested)}. Estimate was ${formatNaira(booking.estimatedTotalKobo)}.`} error={fe.actualTotal}>
          <input
            id="actualTotal"
            name="actualTotal"
            inputMode="decimal"
            value={total === "" ? koboToInput(suggested) : total}
            onChange={(e) => setTotal(e.target.value)}
            aria-invalid={!!fe.actualTotal}
            aria-describedby="actualTotal-hint"
            className={cx(inputClass, "tabular text-lg font-semibold")}
          />
        </Field>
        <div className="text-sm">
          <p className="text-xs font-semibold text-ink-2">Balance after saving</p>
          <dl className="mt-2 space-y-1">
            <div className="flex justify-between"><dt className="text-ink-2">Actual total</dt><dd className="tabular">{totalKobo === null ? "—" : formatNaira(totalKobo)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">Successful payments (each counted once)</dt><dd className="tabular">− {formatNaira(paidKobo)}</dd></div>
            <div className="flex justify-between border-t border-line-strong pt-1 font-semibold"><dt>Balance due</dt><dd className="tabular">{totalKobo === null ? "—" : formatNaira(Math.max(totalKobo - paidKobo, 0))}</dd></div>
          </dl>
          {totalKobo !== null && paidKobo > totalKobo && (
            <p className="mt-2 text-xs text-warning">Payments exceed this total by {formatNaira(paidKobo - totalKobo)}. No refund policy is set — handle with the customer directly.</p>
          )}
        </div>
      </div>

      <Field id="completionNote" label="Note for the customer about extras or price changes" hint="Shown on the customer's booking page. Required when the total differs from the estimate." error={fe.completionNote}>
        <textarea id="completionNote" name="completionNote" rows={2} defaultValue={booking.completionNote} aria-invalid={!!fe.completionNote} aria-describedby="completionNote-hint" className={cx(inputClass, "min-h-20")} />
      </Field>

      <Feedback state={state} />
      <Button type="submit" size="lg" loading={pending}>
        <Check aria-hidden className="size-4" /> {completed ? "Update completion" : "Mark completed & save total"}
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
        <Field id="mp-method" label="Received by">
          <select id="mp-method" name="method" className={inputClass} defaultValue="Bank transfer">
            <option>Bank transfer</option>
            <option>Cash</option>
            <option>POS</option>
            <option>Other</option>
          </select>
        </Field>
        <Field id="mp-purpose" label="Towards">
          <select id="mp-purpose" name="purpose" className={inputClass} defaultValue={awaitingDeposit ? "deposit" : "balance"}>
            <option value="deposit">Deposit</option>
            <option value="balance">Balance</option>
          </select>
        </Field>
      </div>
      <Field id="mp-note" label="Note" optional>
        <input id="mp-note" name="note" className={cx(inputClass, "text-sm")} />
      </Field>
      <p className="text-xs text-ink-3">Recorded as a manual entry — clearly labelled as not gateway-verified. Allowed methods await owner confirmation.</p>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" size="sm" loading={pending}>Record manual payment</Button>
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
        {(status === "confirmed" || status === "awaiting_deposit") && (
          <Button variant="danger" size="sm" disabled={pending} onClick={() => run("cancelled", "Cancel this booking? The time slot will be released. No refund is issued automatically (refund terms aren't set).")}>
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

export function BalanceLink({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [copied, setCopied] = useState(false);
  const url = state?.link ? (typeof window !== "undefined" ? window.location.origin : "") + state.link : null;
  return (
    <div className="space-y-3">
      {!url ? (
        <Button size="sm" variant="night" loading={pending} onClick={() => start(async () => setState(await balanceLinkAction(bookingId)))}>
          <Link2 aria-hidden className="size-4" /> Create payment link
        </Button>
      ) : (
        <div className="space-y-2">
          <label htmlFor="pay-link" className="text-xs font-semibold text-ink-2">Customer payment link (demo — not sent automatically)</label>
          <div className="flex gap-2">
            <input id="pay-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={cx(inputClass, "min-w-0 text-sm")} />
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {}
              }}
            >
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <a href={state!.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-sm font-semibold underline">
            Open as the customer<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      )}
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
