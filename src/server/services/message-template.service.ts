import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import { extractTokens } from "./messaging/render";
import type {
  CreateMessageTemplateInput,
  UpdateMessageTemplateInput,
} from "@/lib/validators/marketing";

export async function listTemplates(ctx: AuthedContext) {
  requirePermission(ctx, "marketing.view");
  return ctx.db.messageTemplate.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
}

export async function getTemplate(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "marketing.view");
  return ctx.db.messageTemplate.findUnique({ where: { id } });
}

export async function createTemplate(ctx: AuthedContext, input: CreateMessageTemplateInput) {
  requirePermission(ctx, "marketing.manage");
  const dupe = await ctx.db.messageTemplate.findFirst({ where: { name: input.name } });
  if (dupe) throw new AuthError(409, `A template named "${input.name}" already exists`);

  const variables = extractTokens(input.content + " " + (input.subject ?? ""));

  const tpl = await ctx.db.messageTemplate.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      channel: input.channel,
      category: input.category || null,
      subject: input.subject || null,
      content: input.content,
      variables,
    },
  });
  await writeAudit({
    ctx,
    action: "template.created",
    entityType: "MessageTemplate",
    entityId: tpl.id,
    changes: { after: { name: tpl.name, channel: tpl.channel } },
  });
  return tpl;
}

export async function updateTemplate(
  ctx: AuthedContext,
  id: string,
  input: UpdateMessageTemplateInput,
) {
  requirePermission(ctx, "marketing.manage");
  const existing = await ctx.db.messageTemplate.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Template not found");

  const nextContent = input.content ?? existing.content;
  const nextSubject = input.subject ?? existing.subject ?? "";
  const variables = extractTokens(`${nextContent} ${nextSubject}`);

  const updated = await ctx.db.messageTemplate.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.channel !== undefined ? { channel: input.channel } : {}),
      ...(input.category !== undefined ? { category: input.category || null } : {}),
      ...(input.subject !== undefined ? { subject: input.subject || null } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      variables,
    },
  });
  await writeAudit({
    ctx,
    action: "template.updated",
    entityType: "MessageTemplate",
    entityId: id,
    changes: { after: input },
  });
  return updated;
}

export async function deleteTemplate(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "marketing.manage");
  const existing = await ctx.db.messageTemplate.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Template not found");
  if (existing.isSystem) throw new AuthError(403, "System templates can't be deleted");

  await ctx.db.messageTemplate.delete({ where: { id } });
  await writeAudit({
    ctx,
    action: "template.deleted",
    entityType: "MessageTemplate",
    entityId: id,
  });
}
