import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { OperatingHoursEditor } from "@/components/settings/operating-hours-editor";

export const metadata = { title: "Operating hours" };
export const dynamic = "force-dynamic";

export default async function HoursPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "tenant.view")) redirect("/dashboard");

  const hours = await ctx.db.operatingHours.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { openTime: "asc" }],
  });
  const canEdit = ["OWNER", "ADMIN", "MANAGER"].includes(ctx.role);

  return (
    <div className="mx-auto max-w-[900px] animate-fade-in space-y-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Configure
        </p>
        <h1 className="mt-3 flex items-center gap-3 text-4xl tracking-tight">
          Operating hours
          <Clock className="h-7 w-7 text-primary/60" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          When the restaurant is open. Multiple shifts per day are supported — lunch and dinner
          with a closed afternoon, for example.
        </p>
      </div>

      <OperatingHoursEditor
        shifts={hours.map((h) => ({
          id: h.id,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          shiftName: h.shiftName,
          isClosed: h.isClosed,
        }))}
        canEdit={canEdit}
      />
    </div>
  );
}
