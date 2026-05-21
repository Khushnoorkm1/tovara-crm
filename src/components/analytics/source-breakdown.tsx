import { ReservationSource } from "@prisma/client";

type Slice = { source: ReservationSource; count: number; percent: number };

const SOURCE_LABELS: Record<ReservationSource, string> = {
  ONLINE_WIDGET: "Online widget",
  PHONE: "Phone",
  WALK_IN: "Walk-in",
  GOOGLE_RESERVE: "Google Reserve",
  THIRD_PARTY: "Third-party",
  HOST: "Host",
  OPENTABLE: "OpenTable",
  RESY: "Resy",
  IMPORT: "Imported",
};

const SOURCE_COLORS: Record<ReservationSource, string> = {
  ONLINE_WIDGET: "hsl(var(--primary))",
  PHONE: "hsl(var(--foreground) / 0.75)",
  WALK_IN: "hsl(var(--foreground) / 0.45)",
  GOOGLE_RESERVE: "hsl(var(--success))",
  THIRD_PARTY: "hsl(var(--warning))",
  HOST: "hsl(var(--foreground) / 0.25)",
  OPENTABLE: "hsl(var(--foreground) / 0.6)",
  RESY: "hsl(var(--foreground) / 0.55)",
  IMPORT: "hsl(var(--muted-foreground))",
};

export function SourceBreakdown({ data }: { data: Slice[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No bookings in this period.
      </div>
    );
  }
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Source mix · last 30 days
      </p>
      <p className="mt-2 font-display text-2xl tabular-nums">
        {total.toLocaleString()}{" "}
        <span className="text-xs font-normal text-muted-foreground">bookings</span>
      </p>

      {/* Stacked single-bar overview */}
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-secondary">
        {data.map((d) => (
          <div
            key={d.source}
            style={{ background: SOURCE_COLORS[d.source], width: `${d.percent}%` }}
            title={`${SOURCE_LABELS[d.source]} · ${d.count}`}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-1.5">
        {data.map((d) => (
          <li key={d.source} className="flex items-center gap-3 text-xs">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ background: SOURCE_COLORS[d.source] }}
            />
            <span className="flex-1 truncate">{SOURCE_LABELS[d.source]}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {d.count.toLocaleString()}
            </span>
            <span className="w-10 text-right font-mono tabular-nums text-muted-foreground">
              {d.percent.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
