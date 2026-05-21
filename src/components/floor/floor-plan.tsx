"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Users, Clock, AlertTriangle } from "lucide-react";
import { ReservationStatus, TableShape } from "@prisma/client";
import { assignTableAction, transitionReservationAction } from "@/server/actions/reservation.actions";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------
// Types (kept thin so server can pass JSON-safe shapes)
// ---------------------------------------------------------------------

type ReservationSlim = {
  id: string;
  startTime: string;
  endTime: string;
  partySize: number;
  status: ReservationStatus;
  guestName: string;
  isVip: boolean;
};

type TableSlim = {
  id: string;
  name: string;
  sectionId: string | null;
  minCapacity: number;
  maxCapacity: number;
  shape: TableShape;
  positionX: number | null;
  positionY: number | null;
  reservations: ReservationSlim[];
};

type Section = { id: string; name: string };

// ---------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------

export function FloorPlan({
  sections,
  tables,
  unassigned,
}: {
  sections: Section[];
  tables: TableSlim[];
  unassigned: ReservationSlim[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [seatingReservationId, setSeatingReservationId] = useState<string | null>(null);

  const tablesBySection = useMemo(() => {
    const map = new Map<string, TableSlim[]>();
    for (const t of tables) {
      const key = t.sectionId ?? "_none";
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tables]);

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const seatingReservation =
    unassigned.find((r) => r.id === seatingReservationId) ??
    tables.flatMap((t) => t.reservations).find((r) => r.id === seatingReservationId);

  function tableState(t: TableSlim): "free" | "booked-soon" | "seated" {
    const now = Date.now();
    const seated = t.reservations.some(
      (r) =>
        r.status === ReservationStatus.SEATED &&
        new Date(r.startTime).getTime() <= now &&
        new Date(r.endTime).getTime() > now,
    );
    if (seated) return "seated";
    const soon = t.reservations.some((r) => {
      const start = new Date(r.startTime).getTime();
      return (
        (r.status === ReservationStatus.CONFIRMED || r.status === ReservationStatus.PENDING) &&
        start - now < 60 * 60_000 &&
        start - now > -15 * 60_000
      );
    });
    if (soon) return "booked-soon";
    return "free";
  }

  function handleTableClick(t: TableSlim) {
    if (seatingReservationId) {
      // We're in "seat this reservation" mode — try to assign
      if (t.minCapacity > seatingReservation!.partySize) {
        toast.error(`${t.name} is too small`);
        return;
      }
      if (t.maxCapacity < seatingReservation!.partySize) {
        toast.error(`${t.name} can't seat a party of ${seatingReservation!.partySize}`);
        return;
      }
      start(async () => {
        const res = await assignTableAction(seatingReservationId!, t.id);
        if (res.ok) {
          toast.success(`Assigned to ${t.name}`);
          setSeatingReservationId(null);
          setSelectedTableId(null);
          router.refresh();
        } else {
          toast.error(res.error);
        }
      });
      return;
    }
    setSelectedTableId(t.id);
  }

  function handleSeatNow(r: ReservationSlim) {
    if (!r.id) return;
    start(async () => {
      const res = await transitionReservationAction(r.id, { action: "seat" });
      if (res.ok) {
        toast.success("Seated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* SVG canvas */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        {/* Status banner if seating */}
        {seatingReservationId && seatingReservation ? (
          <div className="flex items-center justify-between gap-3 border-b border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
            <p className="text-foreground">
              Seat <span className="font-medium">{seatingReservation.guestName}</span> · party of{" "}
              {seatingReservation.partySize}
            </p>
            <button
              type="button"
              onClick={() => setSeatingReservationId(null)}
              className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : null}

        <div className="space-y-10 p-6">
          {sections.map((section) => {
            const sectionTables = tablesBySection.get(section.id) ?? [];
            if (sectionTables.length === 0) return null;
            return (
              <SectionCanvas
                key={section.id}
                title={section.name}
                tables={sectionTables}
                tableState={tableState}
                seatingMode={!!seatingReservationId}
                seatingPartySize={seatingReservation?.partySize}
                onTableClick={handleTableClick}
                selectedTableId={selectedTableId}
              />
            );
          })}
        </div>

        {pending ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Updating…
            </p>
          </div>
        ) : null}
      </div>

      {/* Side panel: unassigned + selected table */}
      <aside className="space-y-6">
        {selectedTable ? (
          <TableDetailCard
            table={selectedTable}
            onClose={() => setSelectedTableId(null)}
            onSeat={handleSeatNow}
          />
        ) : null}

        <UnassignedPanel
          items={unassigned}
          onAssign={(r) => setSeatingReservationId(r.id)}
        />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------
// Section canvas
// ---------------------------------------------------------------------

function SectionCanvas({
  title,
  tables,
  tableState,
  seatingMode,
  seatingPartySize,
  onTableClick,
  selectedTableId,
}: {
  title: string;
  tables: TableSlim[];
  tableState: (t: TableSlim) => "free" | "booked-soon" | "seated";
  seatingMode: boolean;
  seatingPartySize: number | undefined;
  onTableClick: (t: TableSlim) => void;
  selectedTableId: string | null;
}) {
  // Compute viewBox bounds
  const xs = tables.map((t) => t.positionX ?? 0);
  const ys = tables.map((t) => t.positionY ?? 0);
  const padding = 60;
  const minX = Math.min(...xs, 0) - padding;
  const maxX = Math.max(...xs, 0) + padding + 100;
  const minY = Math.min(...ys, 0) - padding;
  const maxY = Math.max(...ys, 0) + padding + 100;

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
          className="h-[420px] w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid backdrop */}
          <defs>
            <pattern id={`grid-${title}`} width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.5" />
            </pattern>
          </defs>
          <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill={`url(#grid-${title})`} />

          {tables.map((t) => {
            const state = tableState(t);
            const x = t.positionX ?? 0;
            const y = t.positionY ?? 0;
            const fits = !seatingMode || (
              seatingPartySize !== undefined &&
              t.minCapacity <= seatingPartySize &&
              t.maxCapacity >= seatingPartySize
            );
            return (
              <TableMarker
                key={t.id}
                x={x}
                y={y}
                shape={t.shape}
                name={t.name}
                capacity={t.maxCapacity}
                state={state}
                selected={selectedTableId === t.id}
                seatingMode={seatingMode}
                fits={fits}
                onClick={() => onTableClick(t)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Table SVG element
// ---------------------------------------------------------------------

function TableMarker({
  x,
  y,
  shape,
  name,
  capacity,
  state,
  selected,
  seatingMode,
  fits,
  onClick,
}: {
  x: number;
  y: number;
  shape: TableShape;
  name: string;
  capacity: number;
  state: "free" | "booked-soon" | "seated";
  selected: boolean;
  seatingMode: boolean;
  fits: boolean;
  onClick: () => void;
}) {
  // Size scales with capacity
  const w = shape === "RECTANGLE" ? 80 + capacity * 4 : 70;
  const h = 70;

  const stateColor =
    state === "seated"
      ? "hsl(var(--primary))"
      : state === "booked-soon"
      ? "hsl(var(--warning))"
      : "hsl(var(--card))";
  const strokeColor = selected
    ? "hsl(var(--primary))"
    : state === "free"
    ? "hsl(var(--border))"
    : stateColor;
  const strokeWidth = selected ? 3 : 1.5;
  const opacity = seatingMode && !fits ? 0.3 : 1;
  const cursor = seatingMode && !fits ? "not-allowed" : "pointer";

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={fits || !seatingMode ? onClick : undefined}
      style={{ cursor }}
      opacity={opacity}
    >
      {shape === "ROUND" ? (
        <circle
          cx={w / 2}
          cy={h / 2}
          r={Math.min(w, h) / 2}
          fill={stateColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      ) : shape === "BOOTH" ? (
        <rect
          width={w}
          height={h}
          rx={20}
          ry={20}
          fill={stateColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      ) : (
        <rect
          width={w}
          height={h}
          rx={6}
          ry={6}
          fill={stateColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}

      <text
        x={w / 2}
        y={h / 2 - 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="select-none font-display"
        fontSize="16"
        fill={state === "free" ? "hsl(var(--foreground))" : "hsl(var(--primary-foreground))"}
        fontWeight="500"
      >
        {name}
      </text>
      <text
        x={w / 2}
        y={h / 2 + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        className="select-none"
        fontSize="9"
        letterSpacing="1"
        fill={
          state === "free"
            ? "hsl(var(--muted-foreground))"
            : "hsl(var(--primary-foreground))"
        }
      >
        {capacity} seats
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------
// Table detail card (right side)
// ---------------------------------------------------------------------

function TableDetailCard({
  table,
  onClose,
  onSeat,
}: {
  table: TableSlim;
  onClose: () => void;
  onSeat: (r: ReservationSlim) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <header className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Table
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-tight">{table.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Seats {table.minCapacity}-{table.maxCapacity} · {table.shape.toLowerCase()}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {table.reservations.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No reservations today.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {table.reservations.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-border bg-background p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-sm tabular-nums">
                    {timeShort(r.startTime)}
                  </span>
                </div>
                <StatusDot status={r.status} />
              </div>
              <p className="mt-1.5 text-sm font-medium">
                {r.guestName}
                {r.isVip ? (
                  <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
                    VIP
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">Party of {r.partySize}</p>
              {r.status === ReservationStatus.CONFIRMED || r.status === ReservationStatus.PENDING ? (
                <button
                  onClick={() => onSeat(r)}
                  className="mt-2 w-full rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Mark seated
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Unassigned panel
// ---------------------------------------------------------------------

function UnassignedPanel({
  items,
  onAssign,
}: {
  items: ReservationSlim[];
  onAssign: (r: ReservationSlim) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Unassigned
        </p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">All reservations are seated.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((r) => (
            <li
              key={r.id}
              className="group flex cursor-pointer items-center justify-between rounded-md border border-border bg-background p-3 transition hover:border-primary/50 hover:bg-primary/5"
              onClick={() => onAssign(r)}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-xs tabular-nums">
                    {timeShort(r.startTime)}
                  </span>
                  {r.isVip ? (
                    <span className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-primary">
                      VIP
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm">{r.guestName}</p>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Users className="h-3 w-3" />
                  Party of {r.partySize}
                </p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground opacity-0 transition group-hover:opacity-100">
                Assign →
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
        Click a card, then click a table on the floor.
      </p>
    </div>
  );
}

function StatusDot({ status }: { status: ReservationStatus }) {
  const map: Record<ReservationStatus, string> = {
    PENDING: "bg-warning",
    CONFIRMED: "bg-success",
    SEATED: "bg-primary",
    COMPLETED: "bg-muted-foreground",
    NO_SHOW: "bg-destructive",
    CANCELLED: "bg-muted-foreground",
  };
  return (
    <span className={cn("h-2 w-2 rounded-full", map[status])} title={status.toLowerCase()} />
  );
}

function timeShort(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? "p" : "a";
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, "0")}${period}`;
}
