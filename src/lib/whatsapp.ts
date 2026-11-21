/**
 * WhatsApp click-to-chat links (BUILD_SPEC 6.4): wa.me/<number>?text=<message>. The number is
 * E.164 without the plus. Phones are stored as E.164 already (libphonenumber-js, region NG).
 */
/** A text message (SMS) with the body filled in, for customers who aren't on WhatsApp. */
export function smsLink(e164: string, text: string): string {
  return `sms:+${e164.replace(/\D/g, "")}?body=${encodeURIComponent(text)}`;
}

/** A phone call. */
export function telLink(e164: string): string {
  return `tel:+${e164.replace(/\D/g, "")}`;
}

export function whatsappLink(e164: string, text: string): string {
  const digits = e164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
