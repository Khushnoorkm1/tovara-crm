import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { redirect } from "next/navigation";
import { listTables } from "@/server/services/table.service";
import { ReservationForm } from "@/components/reservations/reservation-form";

export const metadata = { title: "New reservation" };
export const dynamic = "force-dynamic";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "reservation.create")) redirect("/reservations");

  const sp = await searchParams;
  const today = new Date();
  const defaultDate =
    sp.date ??
    `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const tables = await listTables(ctx);
  const tablesForForm = tables.map((t) => ({
    id: t.id,
    name: t.name,
    minCapacity: t.minCapacity,
    maxCapacity: t.maxCapacity,
    sectionName: t.section?.name ?? null,
  }));

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <Link
        href="/reservations"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to reservations
      </Link>

      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Service · New reservation
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">Book a table</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a time, find the guest, confirm the seat.
        </p>
      </div>

      <div className="mt-10">
        <ReservationForm defaultDate={defaultDate} tables={tablesForForm} />
      </div>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
