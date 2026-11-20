/**
 * WhatsApp click-to-chat links (BUILD_SPEC 6.4): wa.me/<number>?text=<message>. The number is
 * E.164 without the plus. Phones are stored as E.164 already (libphonenumber-js, region NG).
 */
export function whatsappLink(e164: string, text: string): string {
  const digits = e164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
