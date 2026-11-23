"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock, Pencil, ShieldCheck } from "lucide-react";
import type { Service, Settings } from "@/domain/types";
import { depositDue } from "@/domain/deposit";
import { addOnTerms, itemsDuration, itemsTotal } from "@/domain/pricing";
import { validateContact, type ContactErrors } from "@/domain/validation";
import { formatNaira } from "@/lib/money";
import { formatDateKey, formatDuration, formatTime } from "@/lib/time";
import { Alert, Button, Field, cx, describedBy, inputClass } from "@/components/ui/primitives";
import { ServiceMeta } from "./service-bits";
import { ServicePhoto } from "@/components/site/service-photo";
import { BookingSummaryPanel, MoneyRows, describeDepositRule, type SummaryLine } from "./booking-summary";
import { DateTimeStep } from "./date-time-step";
import { PaymentProgress } from "./payment-progress";
import { usePaystackPayment, type StartedPayment } from "./use-paystack-payment";
import { PaymentFee } from "./payment-fee";

const STEPS = ["Service", "Extras", "Date & time", "Your details", "Review"] as const;
const SERVICE = 0;
const EXTRAS = 1;
const WHEN = 2;
const DETAILS = 3;
/** Drafts saved by earlier versions of this form. Removed on first visit; nothing is saved any more. */
const OLD_DRAFT_KEYS = ["hc360-booking-draft-v2", "hc360-booking-draft-v1", "hc360-booking-draft"];

interface Contact {
  name: string;
  phone: string;
  email: string;
  noEmail: boolean;
  /** Asked only with noEmail. */
  onWhatsapp: boolean;
  marketingConsent: boolean;
  note: string;
}

const EMPTY_CONTACT: Contact = { name: "", phone: "", email: "", noEmail: false, onWhatsapp: true, marketingConsent: false, note: "" };

export function BookingWizard({
  services,
  settings,
  initialServiceId,
  customerPaysFees,
  salonPhone,
}: {
  services: Service[];
  settings: Pick<Settings, "availability" | "deposit">;
  initialServiceId: string | null;
  /** Paystack adds its fee to the charge, so the review step shows it. */
  customerPaysFees: boolean;
  /** From Settings; null when the owner hasn't added one. */
  salonPhone: { e164: string; display: string } | null;
}) {
  const router = useRouter();
  const mains = useMemo(() => services.filter((s) => s.bookableAlone), [services]);
  const byId = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const [step, setStep] = useState(0);
  const [mainId, setMainId] = useState<string | null>(initialServiceId && mains.some((s) => s.id === initialServiceId) ? initialServiceId : null);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [website, setWebsite] = useState(""); // honeypot: people never see or fill this
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set once the booking exists, so the deposit popup's outcome knows where to go next.
  const created = useRef<{ reference: string; accessToken: string } | null>(null);
  const payment = usePaystackPayment((outcome) => {
    const b = created.current;
    if (!b) return;
    const paid = outcome === "paid" ? "&paid=deposit" : outcome === "cancelled" ? "" : `&paid=${outcome}`;
    router.push(`/booking/${b.reference}?t=${encodeURIComponent(b.accessToken)}${paid}`);
  });
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [summaryFocus, setSummaryFocus] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  // Set once a booking exists. With Cache Components, Next.js keeps this page alive (hidden)
  // after we navigate to the booking, so without a reset a later visit to /book would show the
  // finished form, still "Confirming payment", and save its details back as a draft.
  const bookingDone = useRef(false);

  function clearOldDrafts() {
    try {
      for (const k of OLD_DRAFT_KEYS) sessionStorage.removeItem(k);
    } catch {}
  }

  /** Back to an empty form, once a booking has been made. */
  function resetAfterBooking() {
    bookingDone.current = false;
    created.current = null;
    setStep(0);
    setMainId(initialServiceId && mains.some((s) => s.id === initialServiceId) ? initialServiceId : null);
    setAddOnIds([]);
    setDateKey(null);
    setStartAt(null);
    setContact(EMPTY_CONTACT);
    setWebsite("");
    setErrors({});
    setTouched({});
    setStepError(null);
    payment.reset();
  }

  // After a booking, the old form must never come back. Three ways it could:
  // - Next.js hides this page (Activity) when we move to the booking: the cleanup resets it.
  // - Next.js shows it again: this effect runs again and resets it, in case hiding didn't.
  // - Safari's back-forward cache restores the frozen page (pageshow with persisted).
  // A half-filled form the customer leaves for another page before booking is kept.
  useLayoutEffect(() => {
    if (bookingDone.current) resetAfterBooking();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && bookingDone.current) resetAfterBooking();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      if (bookingDone.current) resetAfterBooking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nothing survives a refresh: a reload always starts an empty form. (Moving between pages
  // inside the site keeps a half-filled form, because Next.js keeps this page alive.)
  useEffect(() => {
    clearOldDrafts();
  }, []);

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

  const main = mainId ? byId.get(mainId) ?? null : null;
  const offeredAddOns = useMemo(() => (main ? main.addOnIds.map((id) => byId.get(id)).filter((s): s is Service => Boolean(s?.availableAsAddOn)) : []), [main, byId]);
  const lines: SummaryLine[] = useMemo(() => {
    if (!main) return [];
    return [
      { key: main.id, name: main.name, priceKobo: main.priceKobo, durationMinutes: main.durationMinutes },
      ...addOnIds.map((id) => byId.get(id)).filter((s): s is Service => Boolean(s)).map((a) => ({ key: a.id, name: a.name, isAddOn: true, ...addOnTerms(a) })),
    ];
  }, [main, addOnIds, byId]);
  const totalKobo = itemsTotal(lines);
  const durationMinutes = itemsDuration(lines);
  const deposit = main ? depositDue({ mainServiceKobo: main.priceKobo, totalKobo }, settings.deposit) : 0;
  const { holdMinutes } = settings.availability;

  function chooseMain(id: string) {
    setStepError(null);
    // A different service changes the duration, so a chosen time may no longer fit.
    if (id !== mainId) {
      setStartAt(null);
      setAddOnIds([]);
    }
    setMainId(id);
  }

  function toggleAddOn(id: string) {
    setStepError(null);
    setStartAt(null);
    setAddOnIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function go(next: number) {
    setStepError(null);
    setStep(next);
  }

  /** The extras step only appears when the chosen service offers extras. */
  const hasExtras = offeredAddOns.length > 0;

  function back() {
    go(step === WHEN && !hasExtras ? SERVICE : step - 1);
  }

  function skipExtras() {
    if (addOnIds.length) {
      setAddOnIds([]);
      setStartAt(null);
    }
    go(WHEN);
  }

  function next() {
    if (step === SERVICE && !main) return setStepError("Choose a service to continue.");
    if (step === SERVICE && !hasExtras) return go(WHEN);
    if (step === WHEN && !startAt) return setStepError("Choose a date and an available time to continue.");
    if (step === DETAILS) {
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
    if (!startAt || !main) return go(main ? WHEN : SERVICE);
    setSubmitting(true);
    setStepError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainServiceId: main.id,
          addOnIds,
          startAt,
          name: contact.name,
          phone: contact.phone,
          email: contact.noEmail ? "" : contact.email,
          noEmail: contact.noEmail,
          onWhatsapp: contact.noEmail ? contact.onWhatsapp : true,
          marketingConsent: contact.marketingConsent,
          customerNote: contact.note,
          website,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error ?? {};
        if (err.code === "SLOT_TAKEN") {
          setStartAt(null);
          setSlotRefresh((n) => n + 1);
          setStep(WHEN);
          setStepError(err.message);
        } else if (err.fieldErrors) {
          setErrors(err.fieldErrors);
          setStep(DETAILS);
          setStepError("summary");
          setSummaryFocus((n) => n + 1);
        } else {
          setStepError(err.message ?? "Something went wrong. Please try again.");
        }
        return;
      }
      bookingDone.current = true;
      created.current = { reference: data.reference, accessToken: data.accessToken };
      const started = data.payment as StartedPayment | null;
      // Paystack couldn't be reached: the time is still held and the booking page offers to pay.
      if (!started) router.push(`/booking/${data.reference}?t=${encodeURIComponent(data.accessToken)}&paid=error`);
      else void payment.pay(async () => started);
    } catch {
      setStepError("We couldn't reach the booking service. Check your connection and try again. Nothing has been charged.");
    } finally {
      setSubmitting(false);
    }
  }

  const visibleError = (f: "name" | "phone" | "email") => (touched[f] ? errors[f] : undefined);
  const errorList = Object.entries(errors) as [keyof ContactErrors, string][];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-36 pt-6 sm:px-6 md:pb-20 md:pt-10">
      <StepIndicator step={step} onJump={(i) => i < step && go(i === EXTRAS && !hasExtras ? SERVICE : i)} />

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0">
          <h1 ref={headingRef} tabIndex={-1} className="type-display text-[2.2rem] focus:outline-none sm:text-[2.75rem]">
            {["What would you like done?", "Add any extras?", "When would you like to come in?", "How can the salon reach you?", "Check and reserve"][step]}
          </h1>
          <p className="mt-2 text-ink-2">
            {[
              "Choose the main service you'd like.",
              "Each extra adds to the price and the time. Skip this if you don't need any.",
              `Showing times that fit about ${formatDuration(durationMinutes)} for your booking.`,
              "Your name, phone number and email. No account needed.",
              "Your time is reserved once the deposit is paid.",
            ][step]}
          </p>

          {stepError && stepError !== "summary" && (
            <Alert tone="danger" role="alert" className="mt-6" title={stepError} />
          )}

          <div className="mt-8">
            {step === SERVICE && (
              <div>
                <fieldset>
                  <legend className="sr-only">Service</legend>
                  <ul className="grid gap-3">
                    {mains.map((s) => {
                      const on = mainId === s.id;
                      return (
                        <li key={s.id}>
                          <label
                            className={cx(
                              "flex cursor-pointer gap-4 rounded-[var(--radius)] border bg-surface p-4 transition-[border-color,box-shadow] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink sm:p-5",
                              on ? "border-accent bg-accent-soft/40 shadow-[var(--shadow-md)]" : "border-line hover:border-line-strong",
                            )}
                          >
                            <input type="radio" name="main-service" checked={on} onChange={() => chooseMain(s.id)} aria-describedby={`svc-desc-${s.id}`} className="peer sr-only" />
                            <span aria-hidden className={cx("mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface")}>
                              {on && <Check className="size-4" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="type-caps text-[0.85rem] text-accent-text">{s.name}</span>
                              <span id={`svc-desc-${s.id}`} className="mt-1 block text-ink-2">{s.description}</span>
                              <span className="mt-3 block">
                                <ServiceMeta service={s} />
                              </span>
                            </span>
                            {s.photo && (
                              <ServicePhoto photo={s.photo} name={s.name} decorative className="size-20 shrink-0 self-start rounded-[var(--radius-control)] sm:h-24 sm:w-32" />
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              </div>
            )}

            {step === EXTRAS && main && (
              <div>
                <fieldset>
                  <legend className="sr-only">Extras for {main.name}</legend>
                  <ul className="grid gap-3">
                    {offeredAddOns.map((a) => {
                      const on = addOnIds.includes(a.id);
                      const terms = addOnTerms(a);
                      return (
                        <li key={a.id}>
                          <label className={cx("flex cursor-pointer items-center gap-4 rounded-[var(--radius)] border bg-surface p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink", on ? "border-accent bg-accent-soft/40" : "border-line hover:border-line-strong")}>
                            <input type="checkbox" checked={on} onChange={() => toggleAddOn(a.id)} className="peer sr-only" />
                            <span aria-hidden className={cx("flex size-6 shrink-0 items-center justify-center rounded-md border-2", on ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface")}>
                              {on && <Check className="size-4" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-ink">{a.name}</span>
                              {a.description && <span className="block text-sm text-ink-3">{a.description}</span>}
                            </span>
                            <span className="shrink-0 text-right text-sm text-ink-2">
                              <span className="tabular block font-semibold text-ink">+{formatNaira(terms.priceKobo)}</span>
                              +{formatDuration(terms.durationMinutes)}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
                <p className="mt-5 rounded-[var(--radius)] bg-sand/60 px-4 py-3 text-sm text-ink" aria-live="polite">
                  <span className="font-semibold">{main.name}</span>
                  {addOnIds.length ? ` + ${addOnIds.length} extra${addOnIds.length === 1 ? "" : "s"}` : ", no extras"}: <span className="tabular font-semibold">{formatNaira(totalKobo)}</span>, about {formatDuration(durationMinutes)}
                </p>
                <Button variant="secondary" onClick={skipExtras} className="mt-4">
                  {addOnIds.length ? "Remove extras and continue" : "Skip, no extras"}
                </Button>
              </div>
            )}

            {step === WHEN && (
              <DateTimeStep
                durationMinutes={durationMinutes}
                dateKey={dateKey}
                startAt={startAt}
                refreshKey={slotRefresh}
                salonPhone={salonPhone}
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

            {step === DETAILS && (
              <form noValidate onSubmit={(e) => { e.preventDefault(); next(); }} className="space-y-5">
                {stepError === "summary" && errorList.length > 0 && (
                  <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-[var(--radius)] border border-danger/30 bg-danger-soft p-4 focus:outline-3 focus:outline-danger">
                    <p className="font-semibold text-ink">Please fix {errorList.length === 1 ? "this" : `these ${errorList.length}`} to continue:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {errorList.map(([field, msg]) => (
                        <li key={field}>
                          <a className="text-danger underline" href={`#f-${field}`}>{msg}</a>
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
                <Field id="f-phone" label="Phone number" required hint="Nigerian mobile, for example 0803 123 4567" error={visibleError("phone")}>
                  <input id="f-phone" type="tel" inputMode="tel" autoComplete="tel" className={inputClass} value={contact.phone}
                    aria-invalid={!!visibleError("phone")}
                    aria-describedby={describedBy("f-phone", { hint: true, error: !!visibleError("phone") })}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })} onBlur={() => blur("phone")} />
                </Field>
                {!contact.noEmail && (
                  <Field id="f-email" label="Email address" required hint="For your confirmation and reminder" error={visibleError("email")}>
                    <input id="f-email" type="email" inputMode="email" autoComplete="email" className={inputClass} value={contact.email}
                      aria-invalid={!!visibleError("email")}
                      aria-describedby={describedBy("f-email", { hint: true, error: !!visibleError("email") })}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })} onBlur={() => blur("email")} />
                  </Field>
                )}
                <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
                  <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-accent)]" checked={contact.noEmail}
                    onChange={(e) => {
                      const noEmail = e.target.checked;
                      const updated = { ...contact, noEmail, email: noEmail ? "" : contact.email };
                      setContact(updated);
                      setErrors(validateContact(updated));
                    }} />
                  <span>I don&apos;t have an email. <span className="text-ink-3">The salon will send your confirmation and reminder another way.</span></span>
                </label>
                {contact.noEmail && (
                  <label className="ml-8 flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
                    <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-accent)]" checked={contact.onWhatsapp}
                      onChange={(e) => setContact({ ...contact, onWhatsapp: e.target.checked })} />
                    <span>
                      This number is on WhatsApp
                      <span className="block text-ink-3">Untick if it isn&apos;t, and the salon will text or call you instead.</span>
                    </span>
                  </label>
                )}
                <Field id="f-note" label="Anything the salon should know?" optional hint="For example, your current loc length or a style you have in mind. The salon can see this.">
                  <textarea id="f-note" rows={3} maxLength={500} className={cx(inputClass, "min-h-24")} value={contact.note}
                    aria-describedby="f-note-hint" onChange={(e) => setContact({ ...contact, note: e.target.value })} />
                </Field>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
                  <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-accent)]" checked={contact.marketingConsent}
                    onChange={(e) => setContact({ ...contact, marketingConsent: e.target.checked })} />
                  <span>Send me occasional offers and news from the salon. <span className="text-ink-3">Optional; you can say no.</span></span>
                </label>
                {/* Honeypot: hidden from people and screen readers; bots that fill it are turned away. */}
                <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label htmlFor="f-website">Website</label>
                  <input id="f-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
                <p className="flex items-start gap-2 text-sm text-ink-3">
                  <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Your details are only used to manage your appointments.
                </p>
                <button type="submit" className="sr-only">Continue</button>
              </form>
            )}

            {isLast && startAt && main && (
              <div className="space-y-6">
                <ReviewBlock title="Service and extras" onEdit={() => go(SERVICE)}>
                  <ul className="divide-y divide-line">
                    {lines.map((l) => (
                      <li key={l.key} className="flex items-start justify-between gap-4 py-2.5">
                        <span>
                          <span className="font-medium">{l.isAddOn && <span className="text-ink-3">+ </span>}{l.name}</span>
                          <span className="block text-sm text-ink-3">{formatDuration(l.durationMinutes)}</span>
                        </span>
                        <span className="tabular shrink-0 text-ink-2">{formatNaira(l.priceKobo)}</span>
                      </li>
                    ))}
                  </ul>
                </ReviewBlock>
                <ReviewBlock title="Date and time" onEdit={() => go(WHEN)}>
                  <p className="font-medium">{formatDateKey(dateKey!, { long: true })}</p>
                  <p className="text-ink-2">{formatTime(startAt)}, about {formatDuration(durationMinutes)} · Ibadan time</p>
                </ReviewBlock>
                <ReviewBlock title="Your details" onEdit={() => go(DETAILS)}>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-ink-2">{[contact.phone, contact.noEmail ? (contact.onWhatsapp ? "No email: WhatsApp" : "No email: text or call") : contact.email].filter(Boolean).join(" · ")}</p>
                  {contact.note && <p className="mt-1 text-sm text-ink-3">Note: {contact.note}</p>}
                </ReviewBlock>

                <section aria-labelledby="pay-title" className="rounded-[var(--radius)] border border-accent/70 bg-surface p-5">
                  <h2 id="pay-title" className="font-semibold">Payment</h2>
                  <div className="mt-3">
                    <MoneyRows totalKobo={totalKobo} depositKobo={deposit} />
                    <PaymentFee amountKobo={deposit} show={customerPaysFees} />
                  </div>
                  <p className="mt-3 text-xs text-ink-3">
                    Deposit: {describeDepositRule(settings.deposit)}. The deposit secures your time and is not refundable. Anything added on the day is included in the balance.
                  </p>
                  <p className="mt-2 text-xs text-ink-2">
                    By paying the deposit you agree to the salon&apos;s{" "}
                    <Link href="/terms" target="_blank" className="font-semibold underline underline-offset-2">booking terms</Link>.
                  </p>
                </section>

                <p className="flex items-start gap-2 text-sm text-ink-2">
                  <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  Your time is held for {holdMinutes} minutes while you pay the deposit. You can pay by card, bank transfer or USSD.
                  {salonPhone && (
                    <>
                      {" "}Questions? Call <a className="font-semibold underline" href={`tel:${salonPhone.e164}`}>{salonPhone.display}</a>.
                    </>
                  )}
                </p>
                <PaymentProgress phase={payment.phase} />
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
                <Button variant="secondary" onClick={back} className="shrink-0 px-4">
                  <ArrowLeft aria-hidden className="size-4" /> <span className="sr-only sm:not-sr-only">Back</span>
                </Button>
              ) : null}
              <div className={cx("min-w-0 flex-1 md:hidden", isLast && "hidden")} aria-live="polite">
                <p className="truncate text-xs text-ink-3">{main ? main.name : "No service yet"}{addOnIds.length ? ` + ${addOnIds.length}` : ""}{startAt ? ` · ${formatTime(startAt)}` : ""}</p>
                <p className="tabular text-sm font-semibold">{main ? `Total ${formatNaira(totalKobo)}` : "Nothing selected"}</p>
              </div>
              {isLast ? (
                <Button size="lg" onClick={submit} loading={submitting || payment.busy} className="flex-1 md:flex-none">
                  {payment.phase === "confirming" ? "Confirming payment…" : submitting || payment.busy ? "Reserving…" : "Pay deposit"}
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
              lines={lines}
              durationMinutes={durationMinutes}
              dateKey={dateKey}
              startAt={startAt}
              totalKobo={totalKobo}
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
                  {done && <span className="sr-only"> (completed, go back)</span>}
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
