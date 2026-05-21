import Link from "next/link";
import { ArrowUpRight, CalendarDays, Users, Clock, AlertTriangle } from "lucide-react";
import { ReservationStatus } from "@prisma/client";
import { requireAuthOrRedirect } from "@/server/tenant";
import { formatTime } from "@/lib/format";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireAuthOrRedirect();
  const { db } = ctx;

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const last30Days = new Date(now);
  last30Days.setDate(last30Days.getDate() - 30);

  // Run dashboard queries in parallel
  const [
    todayReservations,
    upcomingNext,
    totalGuests,
    last30CompletedCount,
    last30NoShowCount,
    todayCoversAgg,
  ] = await Promise.all([
    db.reservation.count({
      where: { reservationDate: { gte: startOfToday, lt: endOfToday } },
    }),
    db.reservation.findMany({
      where: {
        startTime: { gte: now },
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
      },
      orderBy: { startTime: "asc" },
      take: 6,
      include: {
        guest: { select: { firstName: true, lastName: true, vipStatus: true } },
        table: { select: { name: true } },
      },
    }),
    db.guest.count(),
    db.reservation.count({
      where: { startTime: { gte: last30Days }, status: ReservationStatus.COMPLETED },
    }),
    db.reservation.count({
      where: { startTime: { gte: last30Days }, status: ReservationStatus.NO_SHOW },
    }),
    db.reservation.aggregate({
      where: {
        reservationDate: { gte: startOfToday, lt: endOfToday },
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.SEATED, ReservationStatus.COMPLETED] },
      },
      _sum: { partySize: true },
    }),
  ]);

  const totalLast30 = last30CompletedCount + last30NoShowCount;
  const noShowRate = totalLast30 > 0 ? (last30NoShowCount / totalLast30) * 100 : 0;
  const covers = todayCoversAgg._sum.partySize ?? 0;

  return (
    <div className="mx-auto max-w-[1200px] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {greet()} · {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-3 text-5xl tracking-tight">
            Good {timeOfDay()}, <span className="italic">{firstName(ctx.name)}</span>.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            A quiet command center for tonight's service.
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<CalendarDays className="h-4 w-4" />}
          label="Today's reservations"
          value={todayReservations.toString()}
          hint="across lunch + dinner"
        />
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Today's covers"
          value={covers.toString()}
          hint="confirmed seats"
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4" />}
          label="No-show rate"
          value={`${noShowRate.toFixed(1)}%`}
          hint="last 30 days"
          tone={noShowRate > 10 ? "warning" : "default"}
        />
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Guest database"
          value={totalGuests.toLocaleString()}
          hint="lifetime"
        />
      </div>

      {/* Coming up */}
      <section className="mt-14">
        <header className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              On the floor
            </p>
            <h2 className="mt-2 text-3xl tracking-tight">Coming up</h2>
          </div>
          <Link
            href="/reservations"
            className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            All reservations <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        {upcomingNext.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-border p-12 text-center">
            <Clock className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No upcoming reservations.</p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {upcomingNext.map((r) => {
              const guestName = r.guest
                ? `${r.guest.firstName} ${r.guest.lastName ?? ""}`.trim()
                : `${r.guestFirstName ?? "Walk-in"} ${r.guestLastName ?? ""}`.trim();
              return (
                <li key={r.id} className="flex items-center gap-4 px-5 py-4 transition hover:bg-secondary/40">
                  <div className="flex w-20 flex-col items-center text-center">
                    <span className="font-display text-2xl tabular-nums">{formatTime(r.startTime, "h:mm")}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatTime(r.startTime, "a")}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {guestName}
                      {r.guest?.vipStatus === "VIP" ? (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
                          VIP
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Party of {r.partySize}
                      {r.table ? ` · Table ${r.table.name}` : " · No table assigned"}
                      {r.occasion ? ` · ${r.occasion}` : ""}
                    </p>
                  </div>
                  <StatusPill status={r.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Build status — all 9 phases done */}
      <section className="mt-14 rounded-lg border border-success/30 bg-success/5 p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-success">
          Build complete
        </p>
        <h3 className="mt-2 font-display text-2xl tracking-tight">All 9 phases shipped</h3>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Reservations, public booking, CRM, loyalty, marketing, analytics, integrations, and
          polish — all on one shared data model. Read{" "}
          <code className="font-mono text-xs">README.md</code> for the full architecture tour.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="bg-card p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p
        className={`mt-3 font-display text-4xl tabular-nums ${tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatusPill({ status }: { status: ReservationStatus }) {
  const map: Record<ReservationStatus, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-warning/15 text-warning" },
    CONFIRMED: { label: "Confirmed", className: "bg-success/15 text-success" },
    SEATED: { label: "Seated", className: "bg-primary/15 text-primary" },
    COMPLETED: { label: "Completed", className: "bg-muted text-muted-foreground" },
    NO_SHOW: { label: "No-show", className: "bg-destructive/15 text-destructive" },
    CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  };
  const { label, className } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  );
}

function greet(): string {
  const now = new Date();
  return now.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function firstName(name: string | null): string {
  if (!name) return "there";
  return name.split(" ")[0] ?? "there";
}
