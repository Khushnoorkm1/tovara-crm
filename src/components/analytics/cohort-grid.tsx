type CohortRow = {
  cohortMonth: string;
  cohortSize: number;
  retention: Array<{ monthOffset: number; returners: number; percent: number }>;
};

export function CohortGrid({ rows }: { rows: CohortRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Not enough history yet for cohort analysis.
      </div>
    );
  }

  const maxOffset = Math.max(...rows.map((r) => r.retention.length - 1));
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Cohort retention · % returning by month-after-first-visit
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {rows.length} cohorts
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: "2px" }}>
          <thead>
            <tr>
              <th className="text-left font-mono text-[9px] font-normal uppercase tracking-wider text-muted-foreground">
                Cohort
              </th>
              <th className="text-right font-mono text-[9px] font-normal uppercase tracking-wider text-muted-foreground">
                Size
              </th>
              {offsets.map((o) => (
                <th
                  key={o}
                  className="font-mono text-[9px] font-normal uppercase tracking-wider text-muted-foreground"
                >
                  m+{o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cohortMonth}>
                <td className="pr-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {prettyMonth(r.cohortMonth)}
                </td>
                <td className="pr-3 py-1 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {r.cohortSize}
                </td>
                {offsets.map((o) => {
                  const cell = r.retention[o];
                  if (!cell) {
                    return (
                      <td
                        key={o}
                        className="rounded-sm"
                        style={{ background: "transparent" }}
                      />
                    );
                  }
                  return (
                    <td
                      key={o}
                      className="rounded-sm text-center font-mono text-[10px] tabular-nums transition-transform hover:scale-110"
                      title={`${cell.returners} of ${r.cohortSize} returned in month +${o}`}
                      style={{
                        background: cellColor(cell.percent / 100),
                        color: cell.percent > 50 ? "white" : "hsl(var(--foreground))",
                        padding: "8px 4px",
                        minWidth: "44px",
                      }}
                    >
                      {cell.percent}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function prettyMonth(key: string): string {
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function cellColor(intensity: number): string {
  if (intensity === 0) return "hsl(var(--secondary))";
  const alpha = 0.1 + intensity * 0.85;
  return `hsl(var(--primary) / ${alpha.toFixed(2)})`;
}
