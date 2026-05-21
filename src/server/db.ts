import { PrismaClient } from "@prisma/client";

/**
 * Global PrismaClient singleton.
 * Avoids exhausting database connections in development hot-reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// =====================================================================
//  Tenant-scoped client
//
//  Returns a Prisma client extension that:
//    1. auto-injects `tenantId` on `create` for tenant-scoped models
//    2. auto-adds `tenantId` to every `where` clause for those models
//
//  This means service-layer code can write `db.guest.findMany()` without
//  remembering to filter by tenantId — cross-tenant leaks become hard
//  to write by accident.
//
//  Usage:
//    const db = tenantDb(tenantId);
//    await db.guest.findMany();        // filtered to this tenant
//    await db.guest.create({ data });   // tenantId injected
// =====================================================================

const TENANT_SCOPED_MODELS = new Set([
  "User",
  "Table",
  "FloorSection",
  "Reservation",
  "ReservationSettings",
  "OperatingHours",
  "SpecialClosure",
  "Guest",
  "GuestTag",
  "GuestNote",
  "WaitlistEntry",
  "LoyaltyProgram",
  "Segment",
  "MessageTemplate",
  "Campaign",
  "Notification",
  "AuditLog",
  "TenantSubscription",
  "PosIntegration",
  "Webhook",
  "ApiKey",
]);

export function tenantDb(tenantId: string) {
  return prisma.$extends({
    name: "tenant-scoping",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) return query(args);

          // Inject tenantId on create / createMany
          if (operation === "create") {
            const a = args as { data?: Record<string, unknown> };
            a.data = { ...a.data, tenantId };
          } else if (operation === "createMany") {
            const a = args as { data?: Record<string, unknown> | Record<string, unknown>[] };
            if (Array.isArray(a.data)) {
              a.data = a.data.map((row) => ({ ...row, tenantId }));
            } else if (a.data) {
              a.data = { ...a.data, tenantId };
            }
          }

          // Inject tenantId into where for read / update / delete operations
          const READ_OR_MUTATE = new Set([
            "findUnique",
            "findUniqueOrThrow",
            "findFirst",
            "findFirstOrThrow",
            "findMany",
            "count",
            "aggregate",
            "groupBy",
            "update",
            "updateMany",
            "delete",
            "deleteMany",
            "upsert",
          ]);

          if (READ_OR_MUTATE.has(operation)) {
            const a = args as { where?: Record<string, unknown> };
            a.where = { ...a.where, tenantId };
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
