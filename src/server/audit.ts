import { prisma } from "./db";
import type { AuthedContext } from "./tenant";

type AuditChanges = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
} | null;

/**
 * Write a single audit log entry.
 *
 * Conventions for `action`:
 *   {entity}.{verb}   e.g. "reservation.created", "guest.updated"
 *
 * `entityType` should match the Prisma model name (e.g. "Reservation").
 */
export async function writeAudit(input: {
  ctx: AuthedContext;
  action: string;
  entityType: string;
  entityId: string;
  changes?: AuditChanges;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const { ctx, action, entityType, entityId, changes, ipAddress, userAgent } = input;
  await prisma.auditLog
    .create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action,
        entityType,
        entityId,
        changes: (changes ?? undefined) as never,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    })
    .catch((err) => {
      // Audit logs must never break the parent operation.
      // Log to console; consider Sentry in production.
      console.error("[audit] failed to write entry:", err);
    });
}

/**
 * Write an audit entry for a system-level event — anything not initiated by
 * an authenticated user. The most common case is a public booking from the
 * /book/[slug] widget. `userId` is recorded as null and `ipAddress`/
 * `userAgent` can be passed in from the request that triggered the event.
 */
export async function writeAuditPublic(input: {
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: AuditChanges;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const { tenantId, action, entityType, entityId, changes, ipAddress, userAgent } = input;
  await prisma.auditLog
    .create({
      data: {
        tenantId,
        userId: null,
        action,
        entityType,
        entityId,
        changes: (changes ?? undefined) as never,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    })
    .catch((err) => {
      console.error("[audit] failed to write public entry:", err);
    });
}

/**
 * Compute a shallow diff between two plain objects.
 * Returns { before, after } restricted to keys whose values differ.
 */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: T,
): AuditChanges {
  const beforeOut: Record<string, unknown> = {};
  const afterOut: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      beforeOut[k] = before[k];
      afterOut[k] = after[k];
    }
  }
  if (Object.keys(afterOut).length === 0) return null;
  return { before: beforeOut, after: afterOut };
}
