type Point = { date: string; covers: number; revenue: number };

export function TimeSeriesChart({ data, height = 220 }: { data: Point[]; height?: number }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No data for this period.
      </div>
    );
  }

  const width = 1000; // SVG is rendered with viewBox; CSS scales it
  const padLeft = 56;
  const padRight = 56;
  const padTop = 16;
  const padBottom = 32;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxCovers = Math.max(1, ...data.map((p) => p.covers));
  const maxRevenue = Math.max(1, ...data.map((p) => p.revenue));

  const x = (i: number) =>
    padLeft + (i / Math.max(1, data.length - 1)) * innerW;
  const yCov = (v: number) => padTop + innerH - (v / maxCovers) * innerH;
  const yRev = (v: number) => padTop + innerH - (v / maxRevenue) * innerH;

  // Covers area path
  const areaPath =
    `M ${x(0)} ${padTop + innerH} ` +
    data.map((p, i) => `L ${x(i)} ${yCov(p.covers)}`).join(" ") +
    ` L ${x(data.length - 1)} ${padTop + innerH} Z`;

  // Revenue line path
  const revPath = data
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yRev(p.revenue)}`)
    .join(" ");

  // Weekly x-axis labels — every 7 days
  const xTicks = data
    .map((p, i) => ({ i, p }))
    .filter((_, i) => i % 7 === 0 || i === data.length - 1);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Covers & revenue · last {data.length} days
        </p>
        <div className="flex items-center gap-4 text-[11px]">
          <Legend swatch="bg-primary/30 border-primary/60" label="Covers (area)" />
          <Legend swatch="bg-foreground" label="Revenue (line)" />
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 h-auto w-full"
        preserveAspectRatio="none"
      >
        {/* Horizontal gridlines */}
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <line
            key={i}
            x1={padLeft}
            x2={width - padRight}
            y1={padTop + innerH * (1 - f)}
            y2={padTop + innerH * (1 - f)}
            stroke="hsl(var(--border))"
            strokeDasharray="2 4"
          />
        ))}

        {/* Covers area */}
        <path d={areaPath} fill="hsl(var(--primary) / 0.18)" stroke="none" />

        {/* Revenue line */}
        <path d={revPath} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.5} />

        {/* x-axis labels */}
        {xTicks.map(({ i, p }) => (
          <text
            key={i}
            x={x(i)}
            y={height - 10}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10, fontFamily: "monospace" }}
          >
            {p.date.slice(5)}
          </text>
        ))}

        {/* y-axis labels — covers on left */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <text
            key={`yc-${f}`}
            x={padLeft - 8}
            y={padTop + innerH * (1 - f) + 4}
            textAnchor="end"
            className="fill-muted-foreground"
            style={{ fontSize: 10, fontFamily: "monospace" }}
          >
            {Math.round(maxCovers * f)}
          </text>
        ))}
        {/* y-axis labels — revenue on right */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <text
            key={`yr-${f}`}
            x={width - padRight + 8}
            y={padTop + innerH * (1 - f) + 4}
            className="fill-muted-foreground"
            style={{ fontSize: 10, fontFamily: "monospace" }}
          >
            ${Math.round((maxRevenue * f) / 100) * 100}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
      <span className={`h-2 w-3 rounded-sm border ${swatch}`} />
      {label}
    </span>
  );
}
