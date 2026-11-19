/**
 * Hashing, tokens and password storage on Web Crypto (`globalThis.crypto`).
 *
 * Web Crypto is available on Node 20+, Cloudflare Workers and Netlify, so this
 * code does not care where the app is hosted (docs/FINAL_PLAN.md, portability rules).
 */

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** URL-safe random token. 32 bytes gives 256 bits, which cannot be guessed. */
export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** SHA-256 as lowercase hex. Used to store tokens so a database leak reveals no working links. */
export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/** Constant-time comparison of two strings, to avoid leaking secrets through timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/** HMAC as lowercase hex (Paystack signs webhooks with HMAC SHA-512). */
export async function hmacHex(algorithm: "SHA-256" | "SHA-512", secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: algorithm }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/* ───────────────────────────── Passwords ───────────────────────────── */

/** OWASP's current recommendation for PBKDF2-HMAC-SHA256. Stored per hash so it can be raised later. */
export const PBKDF2_ITERATIONS = 600_000;
const PASSWORD_PREFIX = "pbkdf2-sha256";

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Returns `pbkdf2-sha256$<iterations>$<salt>$<hash>`. */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  return [PASSWORD_PREFIX, iterations, toBase64Url(salt), toBase64Url(hash)].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, iterRaw, saltRaw, hashRaw] = stored.split("$");
  const iterations = Number(iterRaw);
  if (prefix !== PASSWORD_PREFIX || !Number.isInteger(iterations) || iterations < 1 || !saltRaw || !hashRaw) return false;
  const actual = await pbkdf2(password, fromBase64Url(saltRaw), iterations);
  return timingSafeEqual(toBase64Url(actual), hashRaw);
}

/* ───────────────────────────── Encryption at rest ───────────────────────────── */

async function aesKey(secret: string, purpose: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(`${purpose}:${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * AES-GCM encryption for small secrets stored in the database (2FA seeds).
 * The key is derived from `secret` (AUTH_SECRET) and a purpose label, so a
 * database leak alone does not reveal them. Output: `v1.<iv>.<ciphertext>`.
 */
export async function encryptString(plain: string, secret: string, purpose: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, await aesKey(secret, purpose), encoder.encode(plain));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(data))}`;
}

export async function decryptString(sealed: string, secret: string, purpose: string): Promise<string> {
  const [version, ivRaw, dataRaw] = sealed.split(".");
  if (version !== "v1" || !ivRaw || !dataRaw) throw new Error("Unrecognised encrypted value.");
  const key = await aesKey(secret, purpose);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(ivRaw) as BufferSource }, key, fromBase64Url(dataRaw) as BufferSource);
  return new TextDecoder().decode(plain);
}
