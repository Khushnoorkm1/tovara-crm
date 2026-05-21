type Tier = { tierId: string; name: string; color: string | null; count: number };

export function LoyaltyPulseCard({
  pointsEarned,
  pointsRedeemed,
  activeAccounts,
  totalAccounts,
  tierBreakdown,
}: {
  pointsEarned: number;
  pointsRedeemed: number;
  activeAccounts: number;
  totalAccounts: number;
  tierBreakdown: Tier[];
}) {
  const burnRate =
    pointsEarned > 0 ? Math.round((pointsRedeemed / pointsEarned) * 100) : 0;
  const activeRate =
    totalAccounts > 0 ? Math.round((activeAccounts / totalAccounts) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Loyalty pulse · last 30 days
      </p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Stat label="Points earned" value={pointsEarned.toLocaleString()} />
        <Stat label="Points redeemed" value={pointsRedeemed.toLocaleString()} />
        <Stat label="Burn rate" value={`${burnRate}%`} hint="redeemed ÷ earned" />
        <Stat label="Active accounts" value={`${activeAccounts}/${totalAccounts}`} hint={`${activeRate}% active`} />
      </div>

      {tierBreakdown.length > 0 ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Tier distribution
          </p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-secondary">
            {tierBreakdown.map((t) => {
              const total = tierBreakdown.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? (t.count / total) * 100 : 0;
              return (
                <div
                  key={t.tierId}
                  style={{ background: t.color ?? "hsl(var(--muted))", width: `${pct}%` }}
                  title={`${t.name} · ${t.count}`}
                />
              );
            })}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {tierBreakdown.map((t) => (
              <li key={t.tierId} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: t.color ?? "hsl(var(--muted-foreground))" }}
                />
                <span>{t.name}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{t.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function MarketingPulseCard({
  campaignsSent,
  messagesSent,
  openRate,
  clickRate,
}: {
  campaignsSent: number;
  messagesSent: number;
  openRate: number;
  clickRate: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Marketing pulse · last 30 days
      </p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Stat label="Campaigns sent" value={campaignsSent.toLocaleString()} />
        <Stat label="Messages delivered" value={messagesSent.toLocaleString()} />
        <Stat label="Open rate" value={`${openRate.toFixed(1)}%`} />
        <Stat label="Click rate" value={`${clickRate.toFixed(1)}%`} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-xl tabular-nums">{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
