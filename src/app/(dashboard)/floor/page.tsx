import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ReservationStatus } from "@prisma/client";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { redirect } from "next/navigation";
import { getFloorPlan } from "@/server/services/table.service";
import { FloorPlan } from "@/components/floor/floor-plan";

export const metadata = { title: "Floor plan" };
export const dynamic = "force-dynamic";

export default async function FloorPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "table.view")) redirect("/dashboard");

  const sp = await searchParams;
  const dateStr = sp.date ?? formatLocalDate(new Date());
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

  const plan = await getFloorPlan({ ctx, windowStart: dayStart, windowEnd: dayEnd });

  // Reservations on this day with no table assigned — host needs to seat them
  const unassigned = await ctx.db.reservation.findMany({
    where: {
      tableId: null,
      startTime: { gte: dayStart, lt: dayEnd },
      status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    },
    orderBy: { startTime: "asc" },
    include: {
      guest: { select: { firstName: true, lastName: true, vipStatus: true } },
    },
  });

  return (
    <div className="mx-auto max-w-[1400px] animate-fade-in">
      <Link
        href="/reservations"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to reservations
      </Link>

      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Service · Floor plan
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">
          {new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(dayStart)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Click a table to see its reservations · Click an unassigned booking to seat it.
        </p>
      </div>

      <div className="mt-8">
        <FloorPlan
          sections={plan.sections}
          tables={plan.tables.map((t) => ({
            id: t.id,
            name: t.name,
            sectionId: t.sectionId,
            minCapacity: t.minCapacity,
            maxCapacity: t.maxCapacity,
            shape: t.shape,
            positionX: t.positionX,
            positionY: t.positionY,
            reservations: t.reservations.map((r) => ({
              id: r.id,
              startTime: r.startTime.toISOString(),
              endTime: r.endTime.toISOString(),
              partySize: r.partySize,
              status: r.status,
              guestName: r.guest
                ? `${r.guest.firstName} ${r.guest.lastName ?? ""}`.trim()
                : `${r.guestFirstName ?? "Walk-in"} ${r.guestLastName ?? ""}`.trim(),
              isVip: r.guest?.vipStatus === "VIP" || r.guest?.vipStatus === "CELEBRITY",
            })),
          }))}
          unassigned={unassigned.map((r) => ({
            id: r.id,
            startTime: r.startTime.toISOString(),
            endTime: r.endTime.toISOString(),
            partySize: r.partySize,
            status: r.status,
            guestName: r.guest
              ? `${r.guest.firstName} ${r.guest.lastName ?? ""}`.trim()
              : `${r.guestFirstName ?? "Walk-in"} ${r.guestLastName ?? ""}`.trim(),
            isVip: r.guest?.vipStatus === "VIP" || r.guest?.vipStatus === "CELEBRITY",
          }))}
        />
      </div>
    </div>
  );
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
