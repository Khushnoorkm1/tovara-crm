"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Footprints, CheckCheck, Ban, XCircle, Loader2 } from "lucide-react";
import { ReservationStatus } from "@prisma/client";
import { transitionReservationAction } from "@/server/actions/reservation.actions";
import { cn } from "@/lib/utils";
import type { ReservationDetail } from "@/server/services/reservation.service";

export function ReservationActions({ reservation }: { reservation: ReservationDetail }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(action: "seat" | "complete" | "no_show" | "cancel", successMsg: string) {
    start(async () => {
      const res = await transitionReservationAction(reservation.id, { action });
      if (res.ok) {
        toast.success(successMsg);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const status = reservation.status;
  const canSeat = status === ReservationStatus.CONFIRMED || status === ReservationStatus.PENDING;
  const canComplete = status === ReservationStatus.SEATED;
  const canNoShow = canSeat;
  const canCancel = status !== ReservationStatus.COMPLETED && status !== ReservationStatus.CANCELLED;

  if (!canSeat && !canComplete && !canNoShow && !canCancel) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSeat ? (
        <ActionButton onClick={() => run("seat", "Seated")} disabled={pending} primary>
          <Footprints className="h-3.5 w-3.5" />
          Mark seated
        </ActionButton>
      ) : null}
      {canComplete ? (
        <ActionButton onClick={() => run("complete", "Completed")} disabled={pending} primary>
          <CheckCheck className="h-3.5 w-3.5" />
          Complete
        </ActionButton>
      ) : null}
      {canNoShow ? (
        <ActionButton onClick={() => run("no_show", "Marked no-show")} disabled={pending}>
          <Ban className="h-3.5 w-3.5" />
          No-show
        </ActionButton>
      ) : null}
      {canCancel ? (
        <ActionButton onClick={() => run("cancel", "Cancelled")} disabled={pending} destructive>
          <XCircle className="h-3.5 w-3.5" />
          Cancel
        </ActionButton>
      ) : null}
      {pending ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  primary,
  destructive,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition disabled:opacity-50",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : destructive
          ? "border border-border text-destructive hover:bg-destructive/5"
          : "border border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
