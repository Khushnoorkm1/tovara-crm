"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ArrowRight, Cake } from "lucide-react";
import { ReservationStatus } from "@prisma/client";
import { StatusPill } from "@/components/reservations/status-pill";
import { cn } from "@/lib/utils";

type ReservationDto = {
  id: string;
  startTime: string;
  endTime: string;
  partySize: number;
  status: ReservationStatus;
  occasion: string | null;
  tableName: string | null;
};

export function GuestReservations({
  upcoming,
  past,
}: {
  upcoming: ReservationDto[];
  past: ReservationDto[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visiblePast = showAll ? past : past.slice(0, 5);

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Calendar className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          No reservations yet. They'll show up here when this guest books.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {upcoming.length > 0 ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Upcoming · {upcoming.length}
          </p>
          <ul className="mt-2 space-y-2">
            {upcoming.map((r) => (
              <ReservationLine key={r.id} r={r} highlight />
            ))}
          </ul>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Past · {past.length}
          </p>
          <ul className="mt-2 space-y-2">
            {visiblePast.map((r) => (
              <ReservationLine key={r.id} r={r} />
            ))}
          </ul>
          {past.length > 5 && !showAll ? (
            <button
              onClick={() => setShowAll(true)}
              className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Show {past.length - 5} more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReservationLine({ r, highlight }: { r: ReservationDto; highlight?: boolean }) {
  const start = new Date(r.startTime);
  return (
    <li>
      <Link
        href={`/reservations/${r.id}`}
        className={cn(
          "group flex items-center gap-4 rounded-lg border p-3 transition",
          highlight
            ? "border-primary/30 bg-primary/5 hover:border-primary/50"
            : "border-border bg-card hover:bg-secondary",
        )}
      >
        <div className="flex w-16 flex-col items-center text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {start.toLocaleString("en-US", { month: "short" })}
          </p>
          <p className="font-display text-2xl tabular-nums leading-none">{start.getDate()}</p>
          <p className="font-mono text-[9px] tabular-nums text-muted-foreground">
            {start.getFullYear()}
          </p>
        </div>

        <div className="flex-1">
          <p className="text-sm font-medium">
            {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            <span className="ml-2 text-muted-foreground">
              · Party of {r.partySize}
              {r.tableName ? ` · ${r.tableName}` : ""}
            </span>
          </p>
          {r.occasion ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Cake className="h-3 w-3" />
              {r.occasion}
            </p>
          ) : null}
        </div>

        <StatusPill status={r.status} />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </Link>
    </li>
  );
}
