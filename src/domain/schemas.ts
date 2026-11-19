import { z } from "zod";

/**
 * Request shapes for every public route handler and server action (BUILD_SPEC 6.8:
 * validate every input on the server). These check structure and size; business
 * rules with friendly messages (contact details, availability) live in the domain
 * and booking service.
 */

const id = z.string().trim().min(1).max(64);
const reference = z.string().trim().min(3).max(20);
const token = z.string().trim().min(10).max(200);

export const createBookingSchema = z.object({
  mainServiceId: id,
  addOnIds: z.array(id).max(10).default([]),
  startAt: z.iso.datetime({ offset: true }),
  name: z.string().max(200).default(""),
  phone: z.string().max(40).default(""),
  email: z.string().max(200).default(""),
  noEmail: z.boolean().default(false),
  marketingConsent: z.boolean().default(false),
  customerNote: z.string().max(2000).default(""),
  /** Honeypot. */
  website: z.string().max(500).optional(),
});

export const startCheckoutSchema = z.object({
  token,
  purpose: z.enum(["deposit", "balance"]).default("deposit"),
});

export const completeMockCheckoutSchema = z.object({
  token,
  outcome: z.enum(["success", "failed"]),
});

export const availabilityQuerySchema = z.object({
  duration: z.coerce.number().int().min(15).max(12 * 60),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const referenceParam = reference;
export const recordId = id;

/** Parses JSON safely: malformed bodies become null instead of throwing. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function badRequest(message = "Invalid request.") {
  return Response.json({ error: { code: "VALIDATION", message } }, { status: 400 });
}
