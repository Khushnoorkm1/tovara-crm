"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal,
  CheckCheck,
  Footprints,
  XCircle,
  Ban,
  Pencil,
} from "lucide-react";
import { ReservationStatus } from "@prisma/client";
import { transitionReservationAction } from "@/server/actions/reservation.actions";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusPill } from "./status-pill";
import type { ReservationListItem } from "@/server/services/reservation.service";

export function ReservationRow({ reservation }: { reservation: ReservationListItem }) {
  const r = reservation;
  const guestName = r.guest
    ? `${r.guest.firstName} ${r.guest.lastName ?? ""}`.trim()
    : `${r.guestFirstName ?? "Walk-in"} ${r.guestLastName ?? ""}`.trim();
  const isVip = r.guest?.vipStatus === "VIP" || r.guest?.vipStatus === "CELEBRITY";

  return (
    <li className="group flex items-center gap-4 px-5 py-4 transition hover:bg-secondary/40">
      <Link href={`/reservations/${r.id}`} className="flex flex-1 items-center gap-4">
        <div className="flex w-20 flex-col items-center text-center">
          <span className="font-display text-2xl tabular-nums">{formatTime(r.startTime, "h:mm")}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {formatTime(r.startTime, "a")}
          </span>
        </div>

        <div className="flex-1">
          <p className="text-sm font-medium">
            {guestName}
            {isVip ? (
              <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
                VIP
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            Party of {r.partySize}
            {r.table ? ` · Table ${r.table.name}` : " · No table"}
            {r.occasion ? ` · ${r.occasion}` : ""}
          </p>
          {r.specialRequests ? (
            <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">
              "{r.specialRequests}"
            </p>
          ) : null}
        </div>

        <StatusPill status={r.status} />
      </Link>

      <ActionsMenu reservation={r} />
    </li>
  );
}

function ActionsMenu({ reservation }: { reservation: ReservationListItem }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function run(action: "seat" | "complete" | "no_show" | "cancel", successMsg: string) {
    setOpen(false);
    startTransition(async () => {
      const res = await transitionReservationAction(reservation.id, { action });
      if (res.ok) {
        toast.success(successMsg);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const canSeat = reservation.status === ReservationStatus.CONFIRMED || reservation.status === ReservationStatus.PENDING;
  const canComplete = reservation.status === ReservationStatus.SEATED;
  const canNoShow = canSeat;
  const canCancel = reservation.status !== ReservationStatus.COMPLETED && reservation.status !== ReservationStatus.CANCELLED;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground",
          open && "bg-secondary text-foreground",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Reservation actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-10 w-48 origin-top-right animate-fade-in rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          <MenuItem onClick={() => router.push(`/reservations/${reservation.id}`)} icon={<Pencil className="h-3.5 w-3.5" />}>
            Edit details
          </MenuItem>
          <Separator />
          {canSeat ? (
            <MenuItem onClick={() => run("seat", "Marked seated")} icon={<Footprints className="h-3.5 w-3.5" />}>
              Mark seated
            </MenuItem>
          ) : null}
          {canComplete ? (
            <MenuItem onClick={() => run("complete", "Marked completed")} icon={<CheckCheck className="h-3.5 w-3.5" />}>
              Mark completed
            </MenuItem>
          ) : null}
          {canNoShow ? (
            <MenuItem onClick={() => run("no_show", "Marked no-show")} icon={<Ban className="h-3.5 w-3.5" />}>
              No-show
            </MenuItem>
          ) : null}
          {canCancel ? (
            <MenuItem
              onClick={() => run("cancel", "Reservation cancelled")}
              icon={<XCircle className="h-3.5 w-3.5" />}
              destructive
            >
              Cancel
            </MenuItem>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  children,
  destructive,
}: {
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition",
        destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-secondary",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-border" />;
}
