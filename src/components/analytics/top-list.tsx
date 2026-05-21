import Link from "next/link";

type TopItem = {
  id?: string;
  href?: string;
  primary: string;
  secondary?: string | null;
  value: string;
  valueLabel?: string;
};

export function TopList({
  title,
  subtitle,
  items,
  emptyText = "No data yet.",
}: {
  title: string;
  subtitle?: string;
  items: TopItem[];
  emptyText?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ol className="mt-3 space-y-1">
          {items.map((item, idx) => {
            const inner = (
              <>
                <span className="w-6 font-mono text-[10px] tabular-nums text-muted-foreground">
                  #{idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.primary}</p>
                  {item.secondary ? (
                    <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {item.secondary}
                    </p>
                  ) : null}
                </div>
                <p className="text-right">
                  <span className="font-mono text-sm tabular-nums">{item.value}</span>
                  {item.valueLabel ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {item.valueLabel}
                    </span>
                  ) : null}
                </p>
              </>
            );
            return (
              <li key={item.id ?? idx}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-secondary"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="-mx-2 flex items-center gap-3 px-2 py-1.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
