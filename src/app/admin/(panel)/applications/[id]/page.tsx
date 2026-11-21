import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Lock, Mail, MessageCircle, Phone } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { applicationActivity, getApplication } from "@/server/academy";
import { getSalon, requestNow } from "@/server/queries";
import { recordId } from "@/domain/schemas";
import { ageOn, applicationStatusLabel, experienceLabel } from "@/domain/academy";
import { formatPhone } from "@/domain/phone";
import { whatsappLink } from "@/lib/whatsapp";
import { formatDateKey, formatDateTime, lagosDateKey } from "@/lib/time";
import { KeyValue, PageHeader, Panel } from "@/components/admin/bits";
import { ApplicationNoteForm, ApplicationStatusForm } from "@/components/admin/academy-forms";
import { Badge, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Application" };

type Props = { params: Promise<{ id: string }> };

export default function ApplicationPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[36rem]" />}>
      <ApplicationView params={params} />
    </Suspense>
  );
}

async function ApplicationView({ params }: Props) {
  await requireAdmin();
  const { id: raw } = await params;
  const id = recordId.safeParse(raw);
  if (!id.success) notFound();
  const [app, activity, salon, nowMs] = await Promise.all([getApplication(id.data), applicationActivity(id.data), getSalon(), requestNow()]);
  if (!app) notFound();
  const s = applicationStatusLabel[app.status];
  const firstName = app.fullName.split(" ")[0];
  const whatsapp = whatsappLink(app.phone, `Hello ${firstName}, this is ${salon.name} about your Locs Mastery application (${app.reference}) for ${app.programName}.`);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/applications", label: "All applications" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {app.fullName} <Badge tone={s.tone}>{s.label}</Badge>
          </span>
        }
        description={`${app.reference} · ${app.programName} · applied ${formatDateTime(app.createdAt)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Get in touch">
            <div className="flex flex-wrap gap-2">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "sm")}>
                <MessageCircle aria-hidden className="size-4" /> WhatsApp
              </a>
              <a href={`tel:${app.phone}`} className={buttonClass("secondary", "sm")}>
                <Phone aria-hidden className="size-4" /> Call {formatPhone(app.phone)}
              </a>
              <a href={`mailto:${app.email}?subject=${encodeURIComponent(`Your Locs Mastery application (${app.reference})`)}`} className={buttonClass("secondary", "sm")}>
                <Mail aria-hidden className="size-4" /> Email
              </a>
            </div>
            <p className="mt-3 text-xs text-ink-3">After you&apos;ve spoken, set the status so the list stays up to date.</p>
          </Panel>

          <Panel title="Their application">
            <KeyValue
              items={[
                { label: "Program", value: app.programName },
                { label: "Experience", value: experienceLabel[app.experience] },
                { label: "Heard about us", value: app.howHeard || "Not said" },
              ]}
            />
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-3">Why they want to join</h3>
            <p className="mt-2 whitespace-pre-line rounded-[var(--radius)] bg-sand/60 p-4 text-sm text-ink">{app.motivation}</p>
          </Panel>

          <Panel title="Personal details">
            <KeyValue
              items={[
                { label: "Full name", value: app.fullName },
                { label: "Date of birth", value: `${formatDateKey(app.dateOfBirth, { long: true })} (${ageOn(app.dateOfBirth, lagosDateKey(nowMs))} years old)` },
                { label: "Phone", value: formatPhone(app.phone) },
                { label: "Email", value: app.email },
                { label: "Lives in", value: `${app.city}, ${app.state}` },
                { label: "Agreed to data use", value: formatDateTime(app.consentAt) },
                { label: "Program news", value: app.marketingConsent ? "Yes, happy to hear about future programs" : "No" },
              ]}
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Status">
            <ApplicationStatusForm id={app.id} status={app.status} />
          </Panel>
          <Panel title={<span className="flex items-center gap-1.5"><Lock aria-hidden className="size-3.5" /> Private note</span>}>
            <ApplicationNoteForm id={app.id} defaultValue={app.privateNote} />
          </Panel>
          <Panel title="Activity">
            <ol className="relative space-y-4 border-l border-line pl-4">
              {activity.map((e) => (
                <li key={e.id} className="text-sm">
                  <span aria-hidden className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-surface bg-ink-3" />
                  <p className="text-ink">{e.summary}</p>
                  <p className="text-xs text-ink-3">
                    {formatDateTime(e.at)} · {e.actor}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
