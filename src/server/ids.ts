import "server-only";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L

/** Random code from an unambiguous alphabet (Web Crypto, so it runs on any host). */
export function shortCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Short human reference shown to customers, for example HC-7KQ2M. Not a secret. */
export const newBookingReference = () => `HC-${shortCode(5)}`;
