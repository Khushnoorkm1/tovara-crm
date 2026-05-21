type Cell = { dayOfWeek: number; hour: number; covers: number; reservations: number };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ServiceHeatmap({
  cells,
  hoursRange = [11, 22], // 11am to 10pm inclusive
}: {
  cells: Cell[];
  hoursRange?: [number, number];
}) {
  const [minHour, maxHour] = hoursRange;
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  const grid = new Map<string, Cell>();
  for (const c of cells) grid.set(`${c.dayOfWeek}-${c.hour}`, c);

  const max = Math.max(1, ...cells.map((c) => c.covers));

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Service intensity · day × hour · last 60 days
      </p>
      <div className="mt-4">
        <table className="w-full border-separate" style={{ borderSpacing: "2px" }}>
          <thead>
            <tr>
              <th className="w-10" />
              {hours.map((h) => (
                <th
                  key={h}
                  className="font-mono text-[9px] font-normal uppercase tracking-wider text-muted-foreground"
                >
                  {formatHour(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map((label, dow) => (
              <tr key={dow}>
                <td className="pr-2 text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </td>
                {hours.map((h) => {
                  const cell = grid.get(`${dow}-${h}`);
                  const intensity = cell ? cell.covers / max : 0;
                  return (
                    <td
                      key={h}
                      className="aspect-square rounded-sm transition-transform hover:scale-110"
                      title={
                        cell
                          ? `${DAY_LABELS[dow]} ${formatHour(h)} · ${cell.covers} cov · ${cell.reservations} bookings`
                          : `${DAY_LABELS[dow]} ${formatHour(h)} · 0`
                      }
                      style={{
                        background: cellColor(intensity),
                        height: "32px",
                        minWidth: "32px",
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        <span className="font-mono uppercase tracking-wider">less</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.55, 0.8, 1].map((i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-sm"
              style={{ background: cellColor(i) }}
            />
          ))}
        </div>
        <span className="font-mono uppercase tracking-wider">more</span>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? "p" : "a";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${ampm}`;
}

function cellColor(intensity: number): string {
  if (intensity === 0) return "hsl(var(--secondary))";
  // Interpolate from a very pale terracotta to full primary
  const alpha = 0.08 + intensity * 0.92;
  return `hsl(var(--primary) / ${alpha.toFixed(2)})`;
}
