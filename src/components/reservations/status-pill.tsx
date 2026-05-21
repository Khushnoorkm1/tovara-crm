import { ReservationStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const VARIANTS: Record<ReservationStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-warning/15 text-warning ring-warning/30" },
  CONFIRMED: { label: "Confirmed", className: "bg-success/15 text-success ring-success/30" },
  SEATED: { label: "Seated", className: "bg-primary/15 text-primary ring-primary/30" },
  COMPLETED: { label: "Completed", className: "bg-muted text-muted-foreground ring-border" },
  NO_SHOW: { label: "No-show", className: "bg-destructive/15 text-destructive ring-destructive/30" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground ring-border line-through" },
};

export function StatusPill({
  status,
  size = "sm",
  className,
}: {
  status: ReservationStatus;
  size?: "sm" | "xs";
  className?: string;
}) {
  const v = VARIANTS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-mono uppercase tracking-wider ring-1",
        v.className,
        size === "sm" ? "px-2.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[9px]",
        className,
      )}
    >
      {v.label}
    </span>
  );
}
