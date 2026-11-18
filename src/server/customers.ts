import "server-only";
import type { Tx } from "./db";

/**
 * Customer matching without logins (BUILD_SPEC 6.5).
 *
 * 1. The normalised phone matches a customer: it is that customer.
 * 2. Otherwise the email matches: it is that customer, and the new phone is added.
 * 3. Otherwise a new customer is created.
 *
 * Names are never used for matching; every typed name is kept as a variant.
 * Nothing from the matched profile is ever returned to the booking form or customer pages.
 */
export interface ContactForMatching {
  name: string;
  /** E.164. */
  phone: string;
  /** Normalised email, or the generated placeholder for phone-only customers. */
  email: string;
  emailIsPlaceholder: boolean;
  marketingConsent: boolean;
}

export interface MatchResult {
  customerId: string;
  isNew: boolean;
  /** The email already belongs to a different customer, so it was not attached (possible duplicate). */
  emailConflictCustomerId: string | null;
}

export async function matchOrCreateCustomer(tx: Tx, contact: ContactForMatching, now: Date): Promise<MatchResult> {
  const byPhone = await tx.customerPhone.findUnique({ where: { e164: contact.phone } });
  const byEmail = await tx.customerEmail.findUnique({ where: { value: contact.email } });

  let customerId: string;
  let isNew = false;
  let emailConflictCustomerId: string | null = null;

  if (byPhone) {
    customerId = byPhone.customerId;
    if (!byEmail) {
      await tx.customerEmail.create({ data: { customerId, value: contact.email, isPlaceholder: contact.emailIsPlaceholder } });
    } else if (byEmail.customerId !== customerId) {
      // Phone says customer A, email says customer B. Keep both records apart and flag it.
      emailConflictCustomerId = byEmail.customerId;
    }
  } else if (byEmail && !byEmail.isPlaceholder) {
    customerId = byEmail.customerId;
    await tx.customerPhone.create({ data: { customerId, e164: contact.phone } });
  } else {
    isNew = true;
    const created = await tx.customer.create({
      data: {
        displayName: contact.name,
        marketingConsent: contact.marketingConsent,
        marketingConsentAt: contact.marketingConsent ? now : null,
        phones: { create: { e164: contact.phone } },
        // A placeholder can only clash if the same phone already exists, which was handled above.
        emails: byEmail ? undefined : { create: { value: contact.email, isPlaceholder: contact.emailIsPlaceholder } },
      },
    });
    customerId = created.id;
  }

  if (!isNew) {
    // Latest typed name becomes the display name; consent only ever moves from no to yes here.
    await tx.customer.update({
      where: { id: customerId },
      data: {
        displayName: contact.name,
        ...(contact.marketingConsent ? { marketingConsent: true, marketingConsentAt: now } : {}),
      },
    });
  }
  await tx.customerNameVariant.upsert({
    where: { customerId_name: { customerId, name: contact.name } },
    create: { customerId, name: contact.name, firstUsed: now, lastUsed: now },
    update: { lastUsed: now },
  });

  return { customerId, isNew, emailConflictCustomerId };
}
