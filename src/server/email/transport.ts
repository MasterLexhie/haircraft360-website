/**
 * Sends one email through the transport named by EMAIL_TRANSPORT (BUILD_SPEC 4 and 12):
 * - `console` prints it (the default),
 * - `mailpit` posts it to a local Mailpit inbox (MAILPIT_URL, default http://127.0.0.1:8025),
 * - `resend` sends it for real.
 * All three use plain fetch, so this runs on any host. Failures are sorted into kinds the
 * scheduler acts on: stop the batch, retry later, or give up.
 */

export interface EmailAttachment {
  filename: string;
  /** UTF-8 text; encoded to base64 here. */
  content: string;
  contentType: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

/**
 * - `daily_limit`: the provider's daily or monthly quota is used up. Stop and try after the reset.
 * - `rate_limited`: too many requests a second. Stop this batch.
 * - `temporary`: network or provider trouble. Retry later.
 * - `permanent`: the message itself was refused (bad address, bad setup). Retrying won't help.
 */
export type EmailFailureKind = "daily_limit" | "rate_limited" | "temporary" | "permanent";

export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly kind: EmailFailureKind,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

const TIMEOUT_MS = 8_000;

function sender(): { name: string; email: string; raw: string } {
  const raw = process.env.EMAIL_FROM?.trim();
  if (!raw) throw new EmailSendError("EMAIL_FROM is not set.", "permanent");
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1]!.replace(/^"|"$/g, ""), email: m[2]!, raw } : { name: "", email: raw, raw };
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function post(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, method: "POST", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new EmailSendError(`Couldn't reach the email service: ${err instanceof Error ? err.message : String(err)}`, "temporary");
  }
}

async function viaResend(msg: EmailMessage, idempotencyKey: string): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailSendError("RESEND_API_KEY is not set.", "permanent");
  const res = await post("https://api.resend.com/emails", {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.slice(0, 256) },
    body: JSON.stringify({
      from: sender().raw,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: toBase64(a.content), content_type: a.contentType })),
    }),
  });
  const body = (await res.json().catch(() => null)) as { id?: string; name?: string; message?: string } | null;
  if (res.ok && body?.id) return { id: body.id };
  const detail = `Resend ${res.status}${body?.name ? ` ${body.name}` : ""}: ${body?.message ?? "no details"}`;
  if (body?.name === "daily_quota_exceeded" || body?.name === "monthly_quota_exceeded") throw new EmailSendError(detail, "daily_limit");
  if (res.status === 429) throw new EmailSendError(detail, "rate_limited");
  if (res.status >= 500 || res.status === 409) throw new EmailSendError(detail, "temporary");
  throw new EmailSendError(detail, "permanent");
}

async function viaMailpit(msg: EmailMessage): Promise<{ id: string }> {
  const base = (process.env.MAILPIT_URL ?? "http://127.0.0.1:8025").replace(/\/$/, "");
  const from = sender();
  const res = await post(`${base}/api/v1/send`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Email: from.email, Name: from.name },
      To: [{ Email: msg.to }],
      Subject: msg.subject,
      HTML: msg.html,
      Text: msg.text,
      Attachments: msg.attachments?.map((a) => ({ Filename: a.filename, Content: toBase64(a.content), ContentType: a.contentType })),
    }),
  });
  const body = (await res.json().catch(() => null)) as { ID?: string } | null;
  if (res.ok && body?.ID) return { id: body.ID };
  throw new EmailSendError(`Mailpit ${res.status}`, res.status >= 500 ? "temporary" : "permanent");
}

function viaConsole(msg: EmailMessage, idempotencyKey: string): { id: string } {
  const attachments = msg.attachments?.length ? `\nattachments: ${msg.attachments.map((a) => a.filename).join(", ")}` : "";
  console.info(`\n[email] to: ${msg.to}\nsubject: ${msg.subject}${attachments}\n\n${msg.text}\n[/email]\n`);
  return { id: `console-${idempotencyKey}` };
}

/** Sends one email. The idempotency key is the notification ID, so a retry can't send twice. */
export async function sendEmail(msg: EmailMessage, idempotencyKey: string): Promise<{ id: string }> {
  const transport = process.env.EMAIL_TRANSPORT ?? "console";
  if (transport === "resend") return viaResend(msg, idempotencyKey);
  if (transport === "mailpit") return viaMailpit(msg);
  if (transport === "console") return viaConsole(msg, idempotencyKey);
  throw new EmailSendError(`EMAIL_TRANSPORT "${transport}" isn't one of console, mailpit or resend.`, "permanent");
}
