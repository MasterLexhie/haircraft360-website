/**
 * Service photos. The admin's browser shrinks a photo before upload (photo-resize.ts), and the
 * server checks the bytes here: only real WebP or JPEG files of a sane size are stored, and the
 * width and height come from the file itself, never from what the browser says.
 */

/** Stays under the 1 MB Server Action body limit with room for the form's other fields. */
export const MAX_PHOTO_BYTES = 900_000;
/** Longest edge the browser shrinks a photo to. */
export const PHOTO_MAX_EDGE = 1600;
const MAX_DIMENSION = 4000;

export type PhotoType = "image/webp" | "image/jpeg";

export interface PhotoInfo {
  contentType: PhotoType;
  width: number;
  height: number;
}

const ascii = (b: Uint8Array, at: number, text: string) => [...text].every((c, i) => b[at + i] === c.charCodeAt(0));
const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];

function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 30 || !ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  if (ascii(b, 12, "VP8X")) return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (ascii(b, 12, "VP8L")) {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(b, 12, "VP8 ")) {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  return null;
}

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    // Start of frame (baseline, progressive and the rarer kinds), not DHT, JPG or DAC.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: u16be(b, i + 7), height: u16be(b, i + 5) };
    }
    i += 2 + length;
  }
  return null;
}

/** What the bytes really are, with their size, or null if they aren't a usable WebP or JPEG. */
export function readPhoto(bytes: Uint8Array): PhotoInfo | null {
  const webp = webpSize(bytes);
  const size = webp ?? jpegSize(bytes);
  if (!size) return null;
  const { width, height } = size;
  if (!(width > 0 && height > 0 && width <= MAX_DIMENSION && height <= MAX_DIMENSION)) return null;
  return { contentType: webp ? "image/webp" : "image/jpeg", width, height };
}

/** Public address of a service photo. The key changes with every upload. */
export function servicePhotoUrl(serviceId: string, key: string): string {
  return `/media/services/${encodeURIComponent(serviceId)}/${encodeURIComponent(key)}`;
}
