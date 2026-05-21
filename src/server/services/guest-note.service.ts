import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import type {
  CreateGuestNoteInput,
  UpdateGuestNoteInput,
} from "@/lib/validators/guest-note";

export async function createGuestNote(ctx: AuthedContext, input: CreateGuestNoteInput) {
  requirePermission(ctx, "guest.note.create");
  const guest = await ctx.db.guest.findUnique({ where: { id: input.guestId } });
  if (!guest) throw new AuthError(404, "Guest not found");

  const note = await ctx.db.guestNote.create({
    data: {
      tenantId: ctx.tenantId,
      guestId: input.guestId,
      content: input.content,
      isPinned: input.isPinned,
      authorId: ctx.userId,
    },
  });

  await writeAudit({
    ctx,
    action: "guest.note.created",
    entityType: "GuestNote",
    entityId: note.id,
    changes: { after: { guestId: input.guestId, isPinned: note.isPinned } },
  });
  return note;
}

export async function updateGuestNote(
  ctx: AuthedContext,
  id: string,
  input: UpdateGuestNoteInput,
) {
  requirePermission(ctx, "guest.note.create");
  const existing = await ctx.db.guestNote.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Note not found");

  // Authors can edit their own notes; managers+ can edit any
  if (existing.authorId && existing.authorId !== ctx.userId) {
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN" && ctx.role !== "MANAGER") {
      throw new AuthError(403, "You can only edit your own notes");
    }
  }

  const updated = await ctx.db.guestNote.update({
    where: { id },
    data: {
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
    },
  });

  await writeAudit({
    ctx,
    action: "guest.note.updated",
    entityType: "GuestNote",
    entityId: id,
    changes: {
      before: { content: existing.content.slice(0, 80), isPinned: existing.isPinned },
      after: { content: updated.content.slice(0, 80), isPinned: updated.isPinned },
    },
  });
  return updated;
}

export async function deleteGuestNote(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "guest.note.create");
  const existing = await ctx.db.guestNote.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Note not found");

  if (existing.authorId && existing.authorId !== ctx.userId) {
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN" && ctx.role !== "MANAGER") {
      throw new AuthError(403, "You can only delete your own notes");
    }
  }

  await ctx.db.guestNote.delete({ where: { id } });
  await writeAudit({
    ctx,
    action: "guest.note.deleted",
    entityType: "GuestNote",
    entityId: id,
    changes: { before: { content: existing.content.slice(0, 80) } },
  });
}
