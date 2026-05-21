import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import {
  getKpiSummary,
  getTimeSeries,
  getServiceHeatmap,
  getSourceBreakdown,
  getTopGuests,
  getTopTables,
  getCohortRetention,
  getLoyaltyPulse,
  getMarketingPulse,
} from "@/server/services/analytics.service";
import { formatCurrency } from "@/lib/format";
import { KpiTile } from "@/components/analytics/kpi-tile";
import { TimeSeriesChart } from "@/components/analytics/time-series-chart";
import { ServiceHeatmap } from "@/components/analytics/service-heatmap";
import { SourceBreakdown } from "@/components/analytics/source-breakdown";
import { CohortGrid } from "@/components/analytics/cohort-grid";
import { TopList } from "@/components/analytics/top-list";
import { LoyaltyPulseCard, MarketingPulseCard } from "@/components/analytics/pulse-cards";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "analytics.view")) redirect("/dashboard");

  // Fire every aggregation in parallel — Postgres handles it fine and the
  // initial load feels instant.
  const [
    kpi,
    timeSeries,
    heatmap,
    sourceMix,
    topGuests,
    topTables,
    cohorts,
    loyaltyPulse,
    marketingPulse,
  ] = await Promise.all([
    getKpiSummary(ctx, 30),
    getTimeSeries(ctx, 90),
    getServiceHeatmap(ctx, 60),
    getSourceBreakdown(ctx, 30),
    getTopGuests(ctx, 8),
    getTopTables(ctx, 90, 8),
    getCohortRetention(ctx, 6),
    getLoyaltyPulse(ctx, 30),
    getMarketingPulse(ctx, 30),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] animate-fade-in space-y-12">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Insight
        </p>
        <h1 className="mt-3 flex items-center gap-3 text-4xl tracking-tight">
          Analytics
          <TrendingUp className="h-7 w-7 text-primary/60" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Six phases of captured data — covers, revenue, cohorts, source mix, loyalty,
          marketing — surfaced on one screen.
        </p>
      </div>

      {/* KPI strip */}
      <section>
        <SectionHeader number="01" title="Last 30 days · vs prior 30" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiTile label="Covers" value={kpi.covers.value} delta={kpi.covers.delta} />
          <KpiTile
            label="Revenue"
            value={kpi.revenue.value}
            delta={kpi.revenue.delta}
            format="currency"
          />
          <KpiTile
            label="Avg check"
            value={kpi.avgCheck.value}
            delta={kpi.avgCheck.delta}
            format="currency"
          />
          <KpiTile
            label="No-show rate"
            value={kpi.noShowRate.value}
            delta={kpi.noShowRate.delta}
            format="percent"
            tone="inverse"
          />
          <KpiTile
            label="Cancel rate"
            value={kpi.cancelRate.value}
            delta={kpi.cancelRate.delta}
            format="percent"
            tone="inverse"
          />
        </div>
      </section>

      {/* Time series */}
      <section>
        <SectionHeader number="02" title="Volume & revenue" />
        <TimeSeriesChart data={timeSeries} />
      </section>

      {/* Heatmap + source */}
      <section>
        <SectionHeader number="03" title="Service patterns" />
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <ServiceHeatmap cells={heatmap} />
          <SourceBreakdown data={sourceMix} />
        </div>
      </section>

      {/* Cohort retention */}
      <section>
        <SectionHeader number="04" title="Retention" />
        <CohortGrid rows={cohorts} />
      </section>

      {/* Top-N */}
      <section>
        <SectionHeader number="05" title="Top guests & tables" />
        <div className="grid gap-4 lg:grid-cols-2">
          <TopList
            title="Top guests by lifetime spend"
            subtitle="All time"
            items={topGuests.map((g) => ({
              id: g.id,
              href: `/guests/${g.id}`,
              primary: `${g.firstName} ${g.lastName ?? ""}`.trim(),
              secondary: `${g.totalVisits} visit${g.totalVisits === 1 ? "" : "s"}${
                g.vipStatus !== "REGULAR" && g.vipStatus !== "NONE"
                  ? ` · ${g.vipStatus.toLowerCase()}`
                  : ""
              }`,
              value: formatCurrency(g.totalSpend),
            }))}
          />
          <TopList
            title="Hardest-working tables"
            subtitle="Last 90 days · by completed turns"
            items={topTables.map((t) => ({
              id: t.tableId,
              primary: t.label,
              secondary: t.section ?? null,
              value: t.turns.toLocaleString(),
              valueLabel: t.turns === 1 ? "turn" : "turns",
            }))}
          />
        </div>
      </section>

      {/* Loyalty + Marketing pulse */}
      <section>
        <SectionHeader number="06" title="Programs" />
        <div className="grid gap-4 lg:grid-cols-2">
          <LoyaltyPulseCard {...loyaltyPulse} />
          <MarketingPulseCard {...marketingPulse} />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <header className="mb-4 flex items-baseline gap-3 border-b border-border pb-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {number}
      </span>
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
    </header>
  );
}
