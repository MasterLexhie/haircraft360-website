"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarDays, Clock, Search } from "lucide-react";
import { bookingStatusLabel } from "@/domain/labels";
import { formatNaira } from "@/lib/money";
import { formatLongDate, formatTime } from "@/lib/time";
import { Alert, Badge, Button, Field, inputClass } from "@/components/ui/primitives";
import { lookupBooking, type LookupState } from "./actions";

/** Submit button that shows a loading state while the lookup runs. */
function FindSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {!pending && <Search aria-hidden className="size-4" />} Find my booking
    </Button>
  );
}

export function FindBookingForm() {
  const [state, action] = useActionState<LookupState, FormData>(lookupBooking, { status: "idle" });

  if (state.status === "found") {
    const b = state.booking;
    const status = bookingStatusLabel[b.status];
    return (
      <div className="space-y-5" role="status">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Booking reference</p>
            <p className="mt-1 font-display text-2xl tracking-wider text-accent-text">{b.reference}</p>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex gap-3">
            <dt><CalendarDays aria-hidden className="size-5 text-accent-text" /><span className="sr-only">Date</span></dt>
            <dd className="font-medium">{formatLongDate(b.startAt)}</dd>
          </div>
          <div className="flex gap-3">
            <dt><Clock aria-hidden className="size-5 text-accent-text" /><span className="sr-only">Time</span></dt>
            <dd className="font-medium">{formatTime(b.startAt)} <span className="font-normal text-ink-3">· Ibadan time</span></dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-3">
            <dt className="text-ink-2">{b.services.join(", ")}</dt>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Balance</dt>
            <dd className="tabular font-semibold">{formatNaira(b.balanceKobo)}</dd>
          </div>
        </dl>
        <p className="text-sm text-ink-3">To pay online, use the link from your confirmation, or ask the salon to send you a payment link.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state.status === "rate_limited" && <Alert tone="warning" role="alert" title={state.message} />}
      {state.status === "not_found" && (
        <Alert tone="danger" role="alert" title="We couldn't find a booking with those details">
          Check the reference and use the same phone number or email you booked with.
        </Alert>
      )}
      <Field id="reference" label="Booking reference" required hint="Starts with HC-, for example HC-7KQ2M. It's on your confirmation page.">
        <input
          id="reference"
          name="reference"
          required
          defaultValue={state.status === "not_found" || state.status === "rate_limited" ? state.reference : ""}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="HC-"
          aria-describedby="reference-hint"
          aria-invalid={state.status === "not_found" ? true : undefined}
          className={`${inputClass} font-semibold uppercase tracking-[0.12em] tabular`}
        />
      </Field>
      <Field id="contact" label="Phone number or email" required hint="The one you used when you booked.">
        <input
          id="contact"
          name="contact"
          required
          autoComplete="on"
          aria-describedby="contact-hint"
          aria-invalid={state.status === "not_found" ? true : undefined}
          placeholder="0803 123 4567 or you@example.com"
          className={inputClass}
        />
      </Field>
      <FindSubmit />
    </form>
  );
}
