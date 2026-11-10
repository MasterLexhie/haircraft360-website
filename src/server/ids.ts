import "server-only";
import { randomBytes, randomUUID } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L

export function shortCode(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const newId = (prefix: string) => `${prefix}_${randomUUID().slice(0, 12)}`;
export const newBookingReference = () => `HC-${shortCode(5)}`;
export const newAccessToken = () => randomBytes(18).toString("base64url");
