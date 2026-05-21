import { Prisma, WaitlistStatus } from "@prisma/client";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit, diff } from "@/server/audit";
import type { CreateWaitlistInput } from "@/lib/validators/waitlist";

const waitlistInclude = {
  guest: { select: { id: true, firstName: true, lastName: true, vipStatus: true } },
} satisfies Prisma.WaitlistEntryInclude;

export type WaitlistItem = Prisma.WaitlistEntryGetPayload<{ include: typeof waitlistInclude }>;

/**
 * List waitlist entries — by default only active ones (WAITING + NOTIFIED).
 */
export async function listWaitlist(params: {
  ctx: AuthedContext;
  status?: WaitlistStatus[];
  since?: Date;
}) {
  const { ctx, status, since } = params;
  requirePermission(ctx, "waitlist.manage");

  const where: Prisma.WaitlistEntryWhereInput = {
    ...(status && status.length
      ? { status: { in: status } }
      : { status: { in: [WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED] } }),
    ...(since ? { joinedAt: { gte: since } } : {}),
  };

  return ctx.db.waitlistEntry.findMany({
    where,
    orderBy: { joinedAt: "asc" },
    include: waitlistInclude,
  });
}

export async function createWaitlistEntry(ctx: AuthedContext, input: CreateWaitlistInput) {
  requirePermission(ctx, "waitlist.manage");

  // Try to attach to an existing guest by phone
  let guestId: string | null = null;
  if (input.guestPhone) {
    const match = await ctx.db.guest.findFirst({ where: { phone: input.guestPhone } });
    if (match) guestId = match.id;
  }

  const entry = await ctx.db.waitlistEntry.create({
    data: {
      tenantId: ctx.tenantId,
      guestId,
      guestName: input.guestName,
      guestPhone: input.guestPhone || null,
      partySize: input.partySize,
      quotedWaitMinutes: input.quotedWaitMinutes ?? null,
      notes: input.notes || null,
      status: WaitlistStatus.WAITING,
    },
    include: waitlistInclude,
  });

  await writeAudit({
    ctx,
    action: "waitlist.added",
    entityType: "WaitlistEntry",
    entityId: entry.id,
    changes: { after: { guestName: entry.guestName, partySize: entry.partySize } },
  });

  return entry;
}

export async function updateWaitlistStatus(
  ctx: AuthedContext,
  id: string,
  status: WaitlistStatus,
) {
  requirePermission(ctx, "waitlist.manage");

  const existing = await ctx.db.waitlistEntry.findUnique({ where: { id } });
  if (!existing) throw new AuthError(403, "Waitlist entry not found");

  const now = new Date();
  const updated = await ctx.db.waitlistEntry.update({
    where: { id },
    data: {
      status,
      ...(status === WaitlistStatus.NOTIFIED && !existing.notifiedAt ? { notifiedAt: now } : {}),
      ...(status === WaitlistStatus.SEATED && !existing.seatedAt ? { seatedAt: now } : {}),
      ...(status === WaitlistStatus.LEFT || status === WaitlistStatus.CANCELLED
        ? { leftAt: now }
        : {}),
    },
    include: waitlistInclude,
  });

  await writeAudit({
    ctx,
    action: `waitlist.${status.toLowerCase()}`,
    entityType: "WaitlistEntry",
    entityId: id,
    changes: diff({ status: existing.status }, { status: updated.status }),
  });

  return updated;
}
