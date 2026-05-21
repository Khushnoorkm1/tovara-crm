import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "inverse"; // inverse: lower is better (no-show, cancel)

export function KpiTile({
  label,
  value,
  delta,
  format = "number",
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  delta: number;
  format?: "number" | "currency" | "percent";
  tone?: Tone;
  hint?: string;
}) {
  const positive = delta > 0.05;
  const negative = delta < -0.05;
  // For inverse-tone metrics (no-show / cancel rate), positive = bad
  const isGood = tone === "inverse" ? negative : positive;
  const isBad = tone === "inverse" ? positive : negative;

  const arrow = positive ? (
    <ArrowUpRight className="h-3 w-3" />
  ) : negative ? (
    <ArrowDownRight className="h-3 w-3" />
  ) : (
    <Minus className="h-3 w-3" />
  );

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 font-display text-3xl tabular-nums tracking-tight">
        {formatValue(value, format)}
      </p>
      <div
        className={cn(
          "mt-2 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums",
          isGood && "text-success",
          isBad && "text-destructive",
          !isGood && !isBad && "text-muted-foreground",
        )}
      >
        {arrow}
        <span>
          {Math.abs(delta).toFixed(1)}
          {format === "percent" || tone === "inverse" ? "pt" : "%"}
        </span>
        {hint ? <span className="text-muted-foreground"> · {hint}</span> : null}
      </div>
    </div>
  );
}

function formatValue(value: number, format: "number" | "currency" | "percent"): string {
  if (format === "currency") {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (format === "percent") return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}
