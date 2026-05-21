import { Prisma } from "@prisma/client";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import {
  segmentRulesSchema,
  type CreateSegmentInput,
  type UpdateSegmentInput,
  type SegmentRules,
} from "@/lib/validators/marketing";

// ---------------------------------------------------------------------
// Rules → Prisma where clause
// ---------------------------------------------------------------------

/**
 * Translate a SegmentRules JSON object into a Prisma `where` for the Guest
 * model. This is the heart of segmentation — the rest of the service just
 * stores rules and lists/materializes results.
 */
export function rulesToWhere(rules: SegmentRules): Prisma.GuestWhereInput {
  const where: Prisma.GuestWhereInput = {};
  const conditions: Prisma.GuestWhereInput[] = [];

  if (rules.vipStatus && rules.vipStatus.length) {
    conditions.push({ vipStatus: { in: rules.vipStatus } });
  }

  if (rules.tagIds && rules.tagIds.length) {
    if (rules.tagMode === "all") {
      // AND across tag IDs — every tag must be present
      for (const tagId of rules.tagIds) {
        conditions.push({ tags: { some: { tagId } } });
      }
    } else {
      // OR — any tag matches
      conditions.push({ tags: { some: { tagId: { in: rules.tagIds } } } });
    }
  }

  if (rules.loyaltyTierIds && rules.loyaltyTierIds.length) {
    // Guest -> LoyaltyAccount (1:1) -> tier
    conditions.push({
      loyaltyAccount: { tierId: { in: rules.loyaltyTierIds } },
    });
  }

  if (rules.minVisits != null) {
    conditions.push({ totalVisits: { gte: rules.minVisits } });
  }
  if (rules.maxVisits != null) {
    conditions.push({ totalVisits: { lte: rules.maxVisits } });
  }

  if (rules.daysSinceLastVisitMin != null || rules.daysSinceLastVisitMax != null) {
    const now = Date.now();
    const max = rules.daysSinceLastVisitMin; // "at least N days ago" → lastVisit <= now - min
    const min = rules.daysSinceLastVisitMax; // "at most N days ago" → lastVisit >= now - max
    const filter: Prisma.DateTimeFilter = {};
    if (max != null) filter.lte = new Date(now - max * 24 * 60 * 60_000);
    if (min != null) filter.gte = new Date(now - min * 24 * 60 * 60_000);
    conditions.push({ lastVisitAt: filter });
  }

  if (rules.marketingEmailOptIn !== undefined) {
    conditions.push({ marketingEmailOptIn: rules.marketingEmailOptIn });
  }
  if (rules.marketingSmsOptIn !== undefined) {
    conditions.push({ marketingSmsOptIn: rules.marketingSmsOptIn });
  }

  if (conditions.length === 0) return where;
  if (conditions.length === 1) return conditions[0]!;
  return { AND: conditions };
}

// ---------------------------------------------------------------------
// list / get
// ---------------------------------------------------------------------

export async function listSegments(ctx: AuthedContext) {
  requirePermission(ctx, "marketing.view");
  return ctx.db.segment.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
  });
}

export async function getSegment(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "marketing.view");
  return ctx.db.segment.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true } },
    },
  });
}

/**
 * Live count — re-run the rules and return how many guests currently match.
 * Used in the segment builder UI for instant feedback as the user tweaks
 * the criteria.
 */
export async function previewSegmentCount(
  ctx: AuthedContext,
  rules: SegmentRules,
): Promise<number> {
  requirePermission(ctx, "marketing.view");
  const where = rulesToWhere(rules);
  return ctx.db.guest.count({ where });
}

// ---------------------------------------------------------------------
// create / update / delete (also materializes members)
// ---------------------------------------------------------------------

export async function createSegment(ctx: AuthedContext, input: CreateSegmentInput) {
  requirePermission(ctx, "marketing.manage");
  const dupe = await ctx.db.segment.findFirst({ where: { name: input.name } });
  if (dupe) throw new AuthError(409, `A segment named "${input.name}" already exists`);

  const segment = await ctx.db.segment.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      description: input.description || null,
      rules: input.rules as Prisma.InputJsonValue,
      isAuto: true,
    },
  });
  await refreshSegmentMembers(ctx, segment.id);
  await writeAudit({
    ctx,
    action: "segment.created",
    entityType: "Segment",
    entityId: segment.id,
    changes: { after: { name: segment.name } },
  });
  return segment;
}

export async function updateSegment(
  ctx: AuthedContext,
  id: string,
  input: UpdateSegmentInput,
) {
  requirePermission(ctx, "marketing.manage");
  const existing = await ctx.db.segment.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Segment not found");

  const updated = await ctx.db.segment.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.rules !== undefined ? { rules: input.rules as Prisma.InputJsonValue } : {}),
    },
  });
  if (input.rules !== undefined) {
    await refreshSegmentMembers(ctx, updated.id);
  }
  await writeAudit({
    ctx,
    action: "segment.updated",
    entityType: "Segment",
    entityId: id,
  });
  return updated;
}

export async function deleteSegment(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "marketing.manage");
  await ctx.db.segment.delete({ where: { id } });
  await writeAudit({ ctx, action: "segment.deleted", entityType: "Segment", entityId: id });
}

/**
 * Re-run the rules and replace the SegmentMember rows. This is the slow path
 * — campaigns read pre-materialized members instead of re-running the engine
 * at send time.
 */
export async function refreshSegmentMembers(ctx: AuthedContext, segmentId: string) {
  const segment = await ctx.db.segment.findUnique({ where: { id: segmentId } });
  if (!segment) return;
  const rules = segmentRulesSchema.parse(segment.rules);
  const where = rulesToWhere(rules);
  const guests = await ctx.db.guest.findMany({ where, select: { id: true } });

  // Replace members
  await ctx.db.segmentMember.deleteMany({ where: { segmentId } });
  if (guests.length > 0) {
    await ctx.db.segmentMember.createMany({
      data: guests.map((g) => ({ segmentId, guestId: g.id })),
      skipDuplicates: true,
    });
  }
  return guests.length;
}
