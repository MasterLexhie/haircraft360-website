"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock, Pencil, ShieldCheck } from "lucide-react";
import type { Service, Settings } from "@/domain/types";
import { depositFor, estimateServices } from "@/domain/pricing";
import { validateContact, type ContactErrors } from "@/domain/validation";
import { formatNaira } from "@/lib/money";
import { formatDateKey, formatDuration, formatTime, lagosDateKey } from "@/lib/time";
import { business } from "@/config/business";
import { Alert, Button, DemoTag, Field, cx, describedBy, inputClass } from "@/components/ui/primitives";
import { ServiceDemoTag, ServiceMeta } from "./service-bits";
import { BookingSummaryPanel, MoneyRows, describeDepositRule } from "./booking-summary";
import { DateTimeStep } from "./date-time-step";

const STEPS = ["Services", "Date & time", "Your details", "Review"] as const;
const DRAFT_KEY = "hc360-booking-draft-v1";

interface Draft {
  selected: string[];
  dateKey: string | null;
  startAt: string | null;
  name: string;
  phone: string;
  email: string;
  note: string;
}

function readDraft(): Partial<Draft> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}

export function BookingWizard({
  services,
  settings,
  initialSelected,
}: {
  services: Service[];
  settings: Pick<Settings, "availability" | "deposit" | "depositStatus">;
  initialSelected: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(initialSelected.filter((id) => services.some((s) => s.id === id)));
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", note: "" });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [summaryFocus, setSummaryFocus] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Restore an in-progress draft (same tab), unless services came in via the URL.
  // sessionStorage is only readable after hydration, so restoring must happen in an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const d = readDraft();
    if (d) {
      if (!initialSelected.length && d.selected) setSelected(d.selected.filter((id) => services.some((s) => s.id === id)));
      if (d.dateKey && d.dateKey >= lagosDateKey(Date.now())) {
        setDateKey(d.dateKey);
        setStartAt(d.startAt ?? null);
      }
      setContact({ name: d.name ?? "", phone: d.phone ?? "", email: d.email ?? "", note: d.note ?? "" });
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ selected, dateKey, startAt, ...contact } satisfies Draft));
    } catch {
      /* storage unavailable: the flow still works */
    }
  }, [hydrated, selected, dateKey, startAt, contact]);

  // Move focus to the step heading on step change (not on first load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // After a failed submit, move focus to the linked error summary.
  useEffect(() => {
    if (summaryFocus) summaryRef.current?.focus();
  }, [summaryFocus]);

  const chosen = useMemo(() => services.filter((s) => selected.includes(s.id)), [services, selected]);
  const { defaultDurationMinutes, pendingHoldMinutes } = settings.availability;
  const estimate = estimateServices(chosen, defaultDurationMinutes);
  const deposit = depositFor(estimate.totalKobo, settings.deposit);

  function toggle(id: string) {
    setStepError(null);
    // Changing services changes the duration, so a chosen time may no longer fit.
    setStartAt(null);
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function go(next: number) {
    setStepError(null);
    setStep(next);
  }

  function next() {
    if (step === 0 && selected.length === 0) return setStepError("Choose at least one service to continue.");
    if (step === 1 && !startAt) return setStepError("Choose a date and an available time to continue.");
    if (step === 2) {
      const errs = validateContact(contact);
      setErrors(errs);
      setTouched({ name: true, phone: true, email: true });
      if (Object.keys(errs).length) {
        setStepError("summary");
        setSummaryFocus((n) => n + 1);
        return;
      }
    }
    go(step + 1);
  }

  function blur(field: "name" | "phone" | "email") {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validateContact(contact));
  }

  async function submit() {
    if (!startAt) return go(1);
    setSubmitting(true);
    setStepError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceIds: selected, startAt, name: contact.name, phone: contact.phone, email: contact.email, customerNote: contact.note }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error ?? {};
        if (err.code === "SLOT_TAKEN") {
          setStartAt(null);
          setSlotRefresh((n) => n + 1);
          setStep(1);
          setStepError(err.message);
        } else if (err.fieldErrors) {
          setErrors(err.fieldErrors);
          setStep(2);
          setStepError("summary");
          setSummaryFocus((n) => n + 1);
        } else {
          setStepError(err.message ?? "Something went wrong. Please try again.");
        }
        return;
      }
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      router.push(`/checkout/${data.checkoutReference}`);
    } catch {
      setStepError("We couldn't reach the booking service. Check your connection and try again — nothing has been charged.");
    } finally {
      setSubmitting(false);
    }
  }

  const visibleError = (f: "name" | "phone" | "email") => (touched[f] ? errors[f] : undefined);
  const contactError = touched.phone && touched.email ? errors.contact : undefined;
  const errorList = Object.entries(errors) as [keyof ContactErrors, string][];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-36 pt-6 sm:px-6 md:pb-20 md:pt-10">
      <StepIndicator step={step} onJump={(i) => i < step && go(i)} />

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0">
          <h1 ref={headingRef} tabIndex={-1} className="type-display text-[2.2rem] focus:outline-none sm:text-[2.75rem]">
            {["What would you like done?", "When would you like to come in?", "How can the salon reach you?", "Check and reserve"][step]}
          </h1>
          <p className="mt-2 text-ink-2">
            {[
              "Select one or more services. You can change this later in the flow.",
              `Showing times that fit about ${formatDuration(estimate.durationMinutes || defaultDurationMinutes)} for your selection.`,
              "Name plus a phone number or email is all that's needed. No account required.",
              "Nothing is final until the demo deposit is completed.",
            ][step]}
          </p>

          {stepError && stepError !== "summary" && (
            <Alert tone="danger" role="alert" className="mt-6" title={stepError} />
          )}

          <div className="mt-8">
            {step === 0 && (
              <fieldset>
                <legend className="sr-only">Services</legend>
                <ul className="grid gap-3">
                  {services.map((s) => {
                    const on = selected.includes(s.id);
                    return (
                      <li key={s.id}>
                        <label
                          className={cx(
                            "flex cursor-pointer gap-4 rounded-[var(--radius)] border bg-surface p-4 transition-[border-color,box-shadow] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink sm:p-5",
                            on ? "border-accent bg-accent-soft/40 shadow-[var(--shadow-md)]" : "border-line hover:border-line-strong",
                          )}
                        >
                          <input type="checkbox" checked={on} onChange={() => toggle(s.id)} aria-label={`${s.name}${s.status === "demo" ? " (demo service)" : ""}`} aria-describedby={`svc-desc-${s.id}`} className="peer sr-only" />
                          <span aria-hidden className={cx("mt-1 flex size-6 shrink-0 items-center justify-center rounded-md border-2", on ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface")}>
                            {on && <Check className="size-4" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="type-caps text-[0.85rem] text-accent-text">{s.name}</span>
                              <ServiceDemoTag service={s} />
                            </span>
                            <span id={`svc-desc-${s.id}`} className="mt-1 block text-ink-2">{s.description}</span>
                            <span className="mt-3 block">
                              <ServiceMeta service={s} defaultDuration={defaultDurationMinutes} />
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            {step === 1 && (
              <DateTimeStep
                durationMinutes={estimate.durationMinutes || defaultDurationMinutes}
                dateKey={dateKey}
                startAt={startAt}
                refreshKey={slotRefresh}
                onDate={(d) => {
                  setStepError(null);
                  setDateKey(d);
                  setStartAt(null);
                }}
                onSlot={(s) => {
                  setStepError(null);
                  setStartAt(s);
                }}
              />
            )}

            {step === 2 && (
              <form noValidate onSubmit={(e) => { e.preventDefault(); next(); }} className="space-y-5">
                {stepError === "summary" && errorList.length > 0 && (
                  <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-[var(--radius)] border border-danger/30 bg-danger-soft p-4 focus:outline-3 focus:outline-danger">
                    <p className="font-semibold text-ink">Please fix {errorList.length === 1 ? "this" : `these ${errorList.length}`} to continue:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {errorList.map(([field, msg]) => (
                        <li key={field}>
                          <a className="text-danger underline" href={`#f-${field === "contact" ? "phone" : field}`}>{msg}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Field id="f-name" label="Full name" required error={visibleError("name")}>
                  <input id="f-name" className={inputClass} autoComplete="name" value={contact.name}
                    aria-invalid={!!visibleError("name")} aria-describedby={describedBy("f-name", { error: !!visibleError("name") })}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })} onBlur={() => blur("name")} />
                </Field>
                <fieldset className="space-y-4 rounded-[var(--radius)] border border-line bg-surface/60 p-4">
                  <legend className="px-1 text-sm font-semibold text-ink">Contact — phone or email (at least one)</legend>
                  {contactError && (
                    <p id="contact-error" className="text-sm font-medium text-danger">{contactError}</p>
                  )}
                  <Field id="f-phone" label="Phone number" hint="Nigerian mobile, e.g. 0803 123 4567" error={visibleError("phone")}>
                    <input id="f-phone" type="tel" inputMode="tel" autoComplete="tel" className={inputClass} value={contact.phone}
                      aria-invalid={!!visibleError("phone") || !!contactError}
                      aria-describedby={[describedBy("f-phone", { hint: true, error: !!visibleError("phone") }), contactError && "contact-error"].filter(Boolean).join(" ")}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })} onBlur={() => blur("phone")} />
                  </Field>
                  <Field id="f-email" label="Email address" error={visibleError("email")}>
                    <input id="f-email" type="email" inputMode="email" autoComplete="email" className={inputClass} value={contact.email}
                      aria-invalid={!!visibleError("email") || !!contactError}
                      aria-describedby={[describedBy("f-email", { error: !!visibleError("email") }), contactError && "contact-error"].filter(Boolean).join(" ") || undefined}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })} onBlur={() => blur("email")} />
                  </Field>
                </fieldset>
                <Field id="f-note" label="Anything the salon should know?" optional hint="E.g. current loc length or a style you have in mind. The salon can see this.">
                  <textarea id="f-note" rows={3} maxLength={500} className={cx(inputClass, "min-h-24")} value={contact.note}
                    aria-describedby="f-note-hint" onChange={(e) => setContact({ ...contact, note: e.target.value })} />
                </Field>
                <p className="flex items-start gap-2 text-sm text-ink-3">
                  <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Your details are only used to manage this appointment. (Prototype: no messages are actually sent.)
                </p>
                <button type="submit" className="sr-only">Continue</button>
              </form>
            )}

            {step === 3 && startAt && (
              <div className="space-y-6">
                <ReviewBlock title="Services" onEdit={() => go(0)}>
                  <ul className="divide-y divide-line">
                    {chosen.map((s) => (
                      <li key={s.id} className="flex items-start justify-between gap-4 py-2.5">
                        <span>
                          <span className="font-medium">{s.name}</span>{" "}
                          {s.status === "demo" && <DemoTag className="ml-1 align-middle">Demo service</DemoTag>}
                          <span className="block text-sm text-ink-3">{formatDuration(s.durationMinutes ?? defaultDurationMinutes)}</span>
                        </span>
                        <span className="tabular shrink-0 text-ink-2">{s.priceKobo === null ? "At appointment" : formatNaira(s.priceKobo)}</span>
                      </li>
                    ))}
                  </ul>
                </ReviewBlock>
                <ReviewBlock title="Date and time" onEdit={() => go(1)}>
                  <p className="font-medium">{formatDateKey(dateKey!, { long: true })}</p>
                  <p className="text-ink-2">{formatTime(startAt)} – about {formatDuration(estimate.durationMinutes)} · Ibadan time</p>
                </ReviewBlock>
                <ReviewBlock title="Your details" onEdit={() => go(2)}>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-ink-2">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
                  {contact.note && <p className="mt-1 text-sm text-ink-3">Note: {contact.note}</p>}
                </ReviewBlock>

                <section aria-labelledby="pay-title" className="rounded-[var(--radius)] border border-accent/70 bg-surface p-5">
                  <h2 id="pay-title" className="font-semibold">Payment</h2>
                  <div className="mt-3">
                    <MoneyRows estimateKobo={estimate.totalKobo} hasUnpriced={estimate.hasUnpricedItems} depositKobo={deposit} />
                  </div>
                  <p className="mt-3 text-xs text-ink-3">
                    Demo deposit rule: {describeDepositRule(settings.deposit)}. Your final bill is confirmed by the salon after your appointment; anything already paid is deducted.
                  </p>
                </section>

                <Alert tone="warning" title="Booking terms not yet published">
                  Haircraft360 hasn&apos;t approved its deposit, cancellation, rescheduling or refund terms yet, so none are shown here.
                  Questions? Call <a href={`tel:${business.phone.value.e164}`}>{business.phone.value.display}</a>.
                </Alert>

                <p className="flex items-start gap-2 text-sm text-ink-2">
                  <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  Your time will be held for {pendingHoldMinutes} minutes (demo setting) while you complete the simulated deposit. No card details are collected.
                </p>
              </div>
            )}
          </div>
          {/* Nav bar: fixed on phones (shows running total), inline on larger screens. */}
          <div
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:static md:mt-10 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto flex max-w-6xl items-center gap-3 md:max-w-none md:justify-between">
              {step > 0 ? (
                <Button variant="secondary" onClick={() => go(step - 1)} className="shrink-0 px-4">
                  <ArrowLeft aria-hidden className="size-4" /> <span className="sr-only sm:not-sr-only">Back</span>
                </Button>
              ) : null}
              <div className={cx("min-w-0 flex-1 md:hidden", isLast && "hidden")} aria-live="polite">
                <p className="truncate text-xs text-ink-3">{chosen.length} service{chosen.length === 1 ? "" : "s"}{startAt ? ` · ${formatTime(startAt)}` : ""}</p>
                <p className="tabular text-sm font-semibold">{chosen.length ? `Deposit ${formatNaira(deposit)}` : "Nothing selected"}</p>
              </div>
              {isLast ? (
                <Button size="lg" onClick={submit} loading={submitting} className="flex-1 md:flex-none">
                  {submitting ? "Reserving…" : <>Pay demo deposit <span className="tabular">{formatNaira(deposit)}</span></>}
                </Button>
              ) : (
                <Button size="lg" onClick={next} className="shrink-0">
                  Continue <ArrowRight aria-hidden className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="hidden md:block">
          <div className="sticky top-24">
            <BookingSummaryPanel
              services={chosen}
              defaultDuration={defaultDurationMinutes}
              durationMinutes={estimate.durationMinutes}
              dateKey={dateKey}
              startAt={startAt}
              estimateKobo={estimate.totalKobo}
              hasUnpriced={estimate.hasUnpricedItems}
              depositKobo={deposit}
              depositRule={settings.deposit}
            />
          </div>
        </aside>
      </div>

    </div>
  );
}

function StepIndicator({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <nav aria-label="Booking progress">
      <p aria-hidden className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3 sm:hidden">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => onJump(i)}
                disabled={!done}
                aria-current={current ? "step" : undefined}
                className="flex min-w-0 items-center gap-2 rounded-full disabled:cursor-default"
              >
                <span
                  className={cx(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular",
                    current ? "border-accent bg-accent text-on-accent" : done ? "border-accent bg-accent-soft text-accent-text" : "border-line-strong bg-surface text-ink-3",
                  )}
                >
                  {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cx("truncate text-[0.7rem] font-semibold uppercase tracking-[0.14em] max-sm:sr-only", current ? "text-accent-text" : "text-ink-3")}>
                  {label}
                  {done && <span className="sr-only"> (completed — go back)</span>}
                </span>
              </button>
              {i < STEPS.length - 1 && <span aria-hidden className={cx("h-0.5 flex-1 rounded", done ? "bg-accent" : "bg-line")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">{title}</h2>
        <button type="button" onClick={onEdit} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink hover:bg-sand">
          <Pencil aria-hidden className="size-3.5" /> Edit<span className="sr-only"> {title.toLowerCase()}</span>
        </button>
      </div>
      {children}
    </section>
  );
}
