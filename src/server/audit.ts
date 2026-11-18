import "server-only";
import type { Tx } from "./db";

export interface AuditInput {
  action: string;
  actorLabel: string;
  actorId?: string | null;
  entityType: string;
  entityId?: string | null;
  bookingId?: string | null;
  customerId?: string | null;
  summary: string;
  data?: Record<string, unknown>;
}

/** Appends to the audit log inside the caller's transaction, so the log and the change commit together. */
export async function audit(tx: Tx, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: input.action,
      actorLabel: input.actorLabel,
      actorId: input.actorId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      bookingId: input.bookingId ?? null,
      customerId: input.customerId ?? null,
      summary: input.summary,
      data: input.data as never,
    },
  });
}
