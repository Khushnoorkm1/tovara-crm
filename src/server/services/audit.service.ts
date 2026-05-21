import type { AuthedContext } from "@/server/tenant";
import { requirePermission } from "@/server/tenant";

export interface ListAuditLogsParams {
  ctx: AuthedContext;
  page?: number;
  pageSize?: number;
  entityType?: string;
  action?: string;
  userId?: string;
}

/**
 * List audit logs for the current tenant, paginated.
 * Newest first.
 */
export async function listAuditLogs(params: ListAuditLogsParams) {
  const { ctx, page = 1, pageSize = 50, entityType, action, userId } = params;
  requirePermission(ctx, "audit.view");

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(action ? { action: { contains: action } } : {}),
    ...(userId ? { userId } : {}),
  };

  const [items, total] = await Promise.all([
    ctx.db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    ctx.db.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
