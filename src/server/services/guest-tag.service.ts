import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import type {
  CreateGuestTagInput,
  AssignGuestTagInput,
} from "@/lib/validators/guest-tag";

export async function listTags(ctx: AuthedContext) {
  requirePermission(ctx, "guest.view");
  return ctx.db.guestTag.findMany({ orderBy: { name: "asc" } });
}

export async function createGuestTag(ctx: AuthedContext, input: CreateGuestTagInput) {
  requirePermission(ctx, "guest.tag.manage");

  const existing = await ctx.db.guestTag.findFirst({ where: { name: input.name } });
  if (existing) throw new AuthError(409, `A tag named "${input.name}" already exists`);

  const tag = await ctx.db.guestTag.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      color: input.color || "#3B82F6",
      isAutoTag: false,
    },
  });

  await writeAudit({
    ctx,
    action: "guest.tag.created",
    entityType: "GuestTag",
    entityId: tag.id,
    changes: { after: { name: tag.name, color: tag.color } },
  });
  return tag;
}

export async function assignGuestTag(ctx: AuthedContext, input: AssignGuestTagInput) {
  requirePermission(ctx, "guest.tag.manage");

  const [guest, tag] = await Promise.all([
    ctx.db.guest.findUnique({ where: { id: input.guestId } }),
    ctx.db.guestTag.findUnique({ where: { id: input.tagId } }),
  ]);
  if (!guest) throw new AuthError(404, "Guest not found");
  if (!tag) throw new AuthError(404, "Tag not found");

  // Idempotent — silently no-op if already assigned
  await ctx.db.guestTagAssignment.upsert({
    where: { guestId_tagId: { guestId: input.guestId, tagId: input.tagId } },
    update: {},
    create: { guestId: input.guestId, tagId: input.tagId },
  });

  await writeAudit({
    ctx,
    action: "guest.tag.assigned",
    entityType: "Guest",
    entityId: input.guestId,
    changes: { after: { tag: tag.name } },
  });
}

export async function unassignGuestTag(ctx: AuthedContext, input: AssignGuestTagInput) {
  requirePermission(ctx, "guest.tag.manage");

  // Auto-tags are recomputed by the engine — manual removal is forbidden so
  // they don't keep flickering back on next recompute.
  const tag = await ctx.db.guestTag.findUnique({ where: { id: input.tagId } });
  if (!tag) throw new AuthError(404, "Tag not found");
  if (tag.isAutoTag) {
    throw new AuthError(403, `"${tag.name}" is an auto-tag and can't be removed manually`);
  }

  await ctx.db.guestTagAssignment
    .delete({
      where: { guestId_tagId: { guestId: input.guestId, tagId: input.tagId } },
    })
    .catch(() => null); // already removed — no-op

  await writeAudit({
    ctx,
    action: "guest.tag.unassigned",
    entityType: "Guest",
    entityId: input.guestId,
    changes: { before: { tag: tag.name } },
  });
}
