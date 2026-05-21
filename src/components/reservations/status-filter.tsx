"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReservationStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const FILTERS: { label: string; value: string; statuses: ReservationStatus[] }[] = [
  { label: "All", value: "all", statuses: [] },
  { label: "Pending", value: "pending", statuses: [ReservationStatus.PENDING] },
  { label: "Confirmed", value: "confirmed", statuses: [ReservationStatus.CONFIRMED] },
  { label: "Seated", value: "seated", statuses: [ReservationStatus.SEATED] },
  { label: "Completed", value: "completed", statuses: [ReservationStatus.COMPLETED] },
  { label: "No-show", value: "no_show", statuses: [ReservationStatus.NO_SHOW] },
  { label: "Cancelled", value: "cancelled", statuses: [ReservationStatus.CANCELLED] },
];

export function StatusFilter() {
  const params = useSearchParams();
  const current = params.get("status") ?? "all";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTERS.map((f) => {
        const next = new URLSearchParams(params.toString());
        if (f.value === "all") next.delete("status");
        else next.set("status", f.value);
        const href = `?${next.toString()}`;
        const active = current === f.value;
        return (
          <Link
            key={f.value}
            href={href}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
