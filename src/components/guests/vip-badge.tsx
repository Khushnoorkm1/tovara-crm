import { GuestVipStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STYLES: Record<GuestVipStatus, { label: string; className: string } | null> = {
  NONE: null,
  REGULAR: { label: "Regular", className: "bg-muted text-muted-foreground" },
  VIP: { label: "VIP", className: "bg-primary/10 text-primary ring-1 ring-primary/30" },
  CELEBRITY: {
    label: "Celebrity",
    className: "bg-warning/15 text-warning ring-1 ring-warning/30",
  },
};

export function VipBadge({
  status,
  className,
}: {
  status: GuestVipStatus;
  className?: string;
}) {
  const style = STYLES[status];
  if (!style) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
