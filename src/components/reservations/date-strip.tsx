"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Render a row of 7 dates centered on `selected`. Dates are strings in
 * YYYY-MM-DD form. Clicking a day pushes `?date=YYYY-MM-DD`.
 */
export function DateStrip({ selected }: { selected: string }) {
  const center = parseLocalDate(selected);
  const days: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const prev = new Date(center);
  prev.setDate(prev.getDate() - 7);
  const next = new Date(center);
  next.setDate(next.getDate() + 7);

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`?date=${formatLocalDate(prev)}`}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      <div className="flex flex-1 gap-1">
        {days.map((d) => {
          const iso = formatLocalDate(d);
          const isSelected = iso === selected;
          const isToday = isSameDay(d, new Date());
          return (
            <Link
              key={iso}
              href={`?date=${iso}`}
              className={cn(
                "group flex flex-1 flex-col items-center justify-center rounded-md border py-2 transition",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-[0.2em]",
                  isSelected
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground",
                )}
              >
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className="mt-1 font-display text-xl tabular-nums">
                {d.getDate()}
              </span>
              {isToday && !isSelected ? (
                <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" />
              ) : null}
            </Link>
          );
        })}
      </div>

      <Link
        href={`?date=${formatLocalDate(next)}`}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
