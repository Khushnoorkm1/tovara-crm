import type { AuthedContext } from "@/server/tenant";
import { requirePermission } from "@/server/tenant";
import { ReservationStatus } from "@prisma/client";

/**
 * Floor plan: sections + tables + each table's reservations within a window.
 *
 * The window defaults to the current day so the floor view shows today's
 * service, but callers can specify any window for planning ahead.
 */
export async function getFloorPlan(params: {
  ctx: AuthedContext;
  windowStart?: Date;
  windowEnd?: Date;
}) {
  const { ctx } = params;
  requirePermission(ctx, "table.view");

  const windowStart = params.windowStart ?? startOfDay(new Date());
  const windowEnd = params.windowEnd ?? endOfDay(new Date());

  const [sections, tables, reservations] = await Promise.all([
    ctx.db.floorSection.findMany({ orderBy: { displayOrder: "asc" } }),
    ctx.db.table.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    ctx.db.reservation.findMany({
      where: {
        startTime: { lt: windowEnd },
        endTime: { gt: windowStart },
        status: {
          in: [
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
            ReservationStatus.SEATED,
            ReservationStatus.COMPLETED,
          ],
        },
        tableId: { not: null },
      },
      orderBy: { startTime: "asc" },
      include: {
        guest: { select: { firstName: true, lastName: true, vipStatus: true } },
      },
    }),
  ]);

  // Bucket reservations by tableId for easy access on the client
  const reservationsByTable = new Map<string, typeof reservations>();
  for (const r of reservations) {
    if (!r.tableId) continue;
    const arr = reservationsByTable.get(r.tableId) ?? [];
    arr.push(r);
    reservationsByTable.set(r.tableId, arr);
  }

  return {
    sections,
    tables: tables.map((t) => ({
      ...t,
      reservations: reservationsByTable.get(t.id) ?? [],
    })),
    reservations,
    windowStart,
    windowEnd,
  };
}

/**
 * Listing for dropdowns / autocompletes on the create form.
 */
export async function listTables(ctx: AuthedContext) {
  requirePermission(ctx, "table.view");
  return ctx.db.table.findMany({
    where: { isActive: true },
    orderBy: [{ section: { displayOrder: "asc" } }, { name: "asc" }],
    include: { section: { select: { id: true, name: true } } },
  });
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}
