"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Check, CheckCircle2, Send } from "lucide-react";
import { HOW_HEARD, MOTIVATION_MAX, MOTIVATION_MIN, NIGERIAN_STATES, experienceLabel, type ExperienceLevel } from "@/domain/academy";
import { Button, Field, cx, describedBy, inputClass } from "@/components/ui/primitives";
import { applyAction, type ApplyState } from "./actions";

export interface OpenProgram {
  id: string;
  name: string;
  duration: string;
  level: string;
}

/**
 * The Locs Mastery application. Basic personal details only: no ID documents. Sent with
 * onSubmit (not <form action>) so a refused form keeps everything typed.
 */
export function ApplyForm({ programs, initialProgramId, maxBirthDate }: { programs: OpenProgram[]; initialProgramId: string | null; maxBirthDate: string }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyAction, null);
  const [, start] = useTransition();
  const [programId, setProgramId] = useState(programs.some((p) => p.id === initialProgramId) ? initialProgramId! : programs.length === 1 ? programs[0]!.id : "");
  const [motivation, setMotivation] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const errorList = Object.entries(fe);

  // After a refused send, move focus to the list of problems; after success, to the receipt.
  useEffect(() => {
    if (state?.ok) doneRef.current?.focus();
    else if (state && !state.ok) summaryRef.current?.focus();
  }, [state]);

  // "Apply for this program" links on the page change the address; follow them.
  // The chosen program pulses once, so the applicant sees their pick from the card is set.
  const [lastInitial, setLastInitial] = useState(initialProgramId);
  const [flashId, setFlashId] = useState<string | null>(programs.some((p) => p.id === initialProgramId) ? initialProgramId : null);
  const [flashRound, setFlashRound] = useState(0);
  if (initialProgramId !== lastInitial) {
    setLastInitial(initialProgramId);
    if (initialProgramId && programs.some((p) => p.id === initialProgramId)) {
      setProgramId(initialProgramId);
      setFlashId(initialProgramId);
      setFlashRound((n) => n + 1);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(() => action(data));
  }

  if (state?.ok) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="rounded-[var(--radius)] bg-surface p-6 text-center shadow-[var(--shadow-md)] focus:outline-none sm:p-10">
        <span className="tick-pop mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft">
          <CheckCircle2 aria-hidden className="size-7 text-success" />
        </span>
        <h3 className="rise type-display mt-5 text-[1.9rem] [--rise-delay:200ms]">Application sent</h3>
        <p className="mt-3 text-ink-2">
          Thank you. Your application for <strong className="text-ink">{state.programName}</strong> is in.
        </p>
        <p className="mt-4 inline-block rounded-[var(--radius)] bg-sand px-4 py-2 text-sm">
          Your reference: <span className="font-semibold tabular text-ink">{state.reference}</span>
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm text-ink-2">
          A copy is on its way to {state.email}. Someone from the salon will contact you within a few days to talk it through.
        </p>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="rounded-[var(--radius)] bg-surface p-6 text-center shadow-[var(--shadow-md)] sm:p-10">
        <h3 className="type-display text-[1.7rem]">Applications are closed for now</h3>
        <p className="mt-3 text-ink-2">The next intake hasn&apos;t opened yet. Check back soon, or follow the salon for news.</p>
      </div>
    );
  }

  const err = (k: string) => fe[k];
  const aria = (id: string, k: string, hint = false) => ({ "aria-invalid": !!err(k), "aria-describedby": describedBy(id, { hint, error: !!err(k) }) });

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-8 rounded-[var(--radius)] bg-surface p-5 shadow-[var(--shadow-md)] sm:p-8">
      {state && !state.ok && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-[var(--radius)] border border-danger/30 bg-danger-soft p-4 focus:outline-3 focus:outline-danger">
          <p className="font-semibold text-ink">{errorList.length ? `Please fix ${errorList.length === 1 ? "this" : `these ${errorList.length}`} to send your application:` : state.error}</p>
          {errorList.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {errorList.map(([field, msg]) => (
                <li key={field}>
                  <a className="text-danger underline" href={`#a-${field}`}>{msg}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <fieldset>
        <legend id="a-programId" className="type-caps text-[0.8rem] text-accent-text">1 · Choose a program</legend>
        <div className="mt-3 grid gap-3">
          {programs.map((p) => {
            const on = programId === p.id;
            return (
              <label
                key={flashId === p.id ? `${p.id}-${flashRound}` : p.id}
                onAnimationEnd={() => setFlashId(null)}
                className={cx(
                  flashId === p.id && "pick-flash",
                  "flex cursor-pointer items-center gap-4 rounded-[var(--radius)] border bg-surface p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                  on ? "border-accent bg-accent-soft/40" : "border-line hover:border-line-strong",
                )}
              >
                <input type="radio" name="programId" value={p.id} checked={on} onChange={() => setProgramId(p.id)} className="sr-only" />
                <span aria-hidden className={cx("flex size-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface")}>
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{p.name}</span>
                  <span className="block text-sm text-ink-3">
                    {p.duration}
                    {p.level ? ` · ${p.level}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {err("programId") && <p className="mt-2 text-sm font-medium text-danger">{err("programId")}</p>}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="type-caps text-[0.8rem] text-accent-text">2 · About you</legend>
        <Field id="a-fullName" label="Full name" required error={err("fullName")}>
          <input id="a-fullName" name="fullName" autoComplete="name" maxLength={80} className={inputClass} {...aria("a-fullName", "fullName")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="a-phone" label="Phone number" required hint="For a call or WhatsApp" error={err("phone")}>
            <input id="a-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className={inputClass} {...aria("a-phone", "phone", true)} />
          </Field>
          <Field id="a-email" label="Email address" required hint="Your copy of the application goes here" error={err("email")}>
            <input id="a-email" name="email" type="email" inputMode="email" autoComplete="email" className={inputClass} {...aria("a-email", "email", true)} />
          </Field>
        </div>
        <Field id="a-dateOfBirth" label="Date of birth" required hint="You need to be 16 or older" error={err("dateOfBirth")}>
          <input id="a-dateOfBirth" name="dateOfBirth" type="date" max={maxBirthDate} min="1930-01-01" autoComplete="bday" className={cx(inputClass, "sm:max-w-64")} {...aria("a-dateOfBirth", "dateOfBirth", true)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="a-city" label="Town or city" required error={err("city")}>
            <input id="a-city" name="city" autoComplete="address-level2" maxLength={60} className={inputClass} {...aria("a-city", "city")} />
          </Field>
          <Field id="a-state" label="State" required error={err("state")}>
            <select id="a-state" name="state" defaultValue="" className={inputClass} {...aria("a-state", "state")}>
              <option value="" disabled>
                Choose your state
              </option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="type-caps text-[0.8rem] text-accent-text">3 · Your experience</legend>
        <div role="radiogroup" aria-labelledby="a-experience" className="space-y-2">
          <p id="a-experience" className="text-sm font-semibold text-ink">
            How much loc work have you done? <span className="text-danger" aria-hidden>*</span>
          </p>
          {(Object.keys(experienceLabel) as ExperienceLevel[]).map((k) => (
            <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input type="radio" name="experience" value={k} className="size-5 accent-[var(--color-accent)]" />
              {experienceLabel[k]}
            </label>
          ))}
          {err("experience") && <p className="text-sm font-medium text-danger">{err("experience")}</p>}
        </div>
        <Field id="a-motivation" label="Why do you want to join, and what do you hope to do afterwards?" required hint="A few sentences is plenty." error={err("motivation")}>
          <textarea
            id="a-motivation"
            name="motivation"
            rows={5}
            maxLength={MOTIVATION_MAX}
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            className={cx(inputClass, "min-h-32")}
            {...aria("a-motivation", "motivation", true)}
          />
        </Field>
        <p className={cx("-mt-2 text-right text-xs tabular", motivation.trim().length < MOTIVATION_MIN ? "text-ink-3" : "text-success")} aria-live="polite">
          {motivation.trim().length < MOTIVATION_MIN ? `${MOTIVATION_MIN - motivation.trim().length} more characters needed` : `${motivation.length} of ${MOTIVATION_MAX}`}
        </p>
        <Field id="a-howHeard" label="How did you hear about us?" optional>
          <select id="a-howHeard" name="howHeard" defaultValue="" className={cx(inputClass, "sm:max-w-80")}>
            <option value="">Choose one</option>
            {HOW_HEARD.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="space-y-3 border-t border-line pt-6">
        <legend className="sr-only">Agreements</legend>
        <label id="a-consent" className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="consent" className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" aria-invalid={!!err("consent")} />
          <span>
            I agree to the salon using these details to review my application and contact me about it. <span className="text-danger" aria-hidden>*</span>
            <span className="block text-ink-3">They&apos;re kept private and never shared or sold.</span>
          </span>
        </label>
        {err("consent") && <p className="text-sm font-medium text-danger">{err("consent")}</p>}
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="marketingConsent" className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
          <span>
            Tell me about future programs and salon news. <span className="text-ink-3">Optional.</span>
          </span>
        </label>
      </fieldset>

      {/* Honeypot: hidden from people and screen readers; bots that fill it are turned away. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-3">Free to apply. Fields marked * are needed.</p>
        <Button type="submit" size="lg" loading={pending}>
          <Send aria-hidden className="size-4" /> Send application
        </Button>
      </div>
    </form>
  );
}
