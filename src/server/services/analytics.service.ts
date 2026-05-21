import { ReservationStatus, ReservationSource } from "@prisma/client";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission } from "@/server/tenant";

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  return startOfDay(new Date(Date.now() - n * 24 * 60 * 60_000));
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal
}

// ---------------------------------------------------------------------
// 1. KPI summary — current period vs prior period
// ---------------------------------------------------------------------

export type KpiSummary = {
  covers: { value: number; delta: number };
  revenue: { value: number; delta: number };
  avgCheck: { value: number; delta: number };
  noShowRate: { value: number; delta: number };
  cancelRate: { value: number; delta: number };
  periodDays: number;
};

export async function getKpiSummary(ctx: AuthedContext, periodDays = 30): Promise<KpiSummary> {
  requirePermission(ctx, "analytics.view");

  const now = new Date();
  const currentStart = daysAgo(periodDays);
  const priorStart = daysAgo(periodDays * 2);

  // Two queries, two periods — fetched in parallel
  const [current, prior] = await Promise.all([
    aggregatePeriod(ctx, currentStart, now),
    aggregatePeriod(ctx, priorStart, currentStart),
  ]);

  return {
    covers: {
      value: current.covers,
      delta: deltaPct(current.covers, prior.covers),
    },
    revenue: {
      value: current.revenue,
      delta: deltaPct(current.revenue, prior.revenue),
    },
    avgCheck: {
      value: current.avgCheck,
      delta: deltaPct(current.avgCheck, prior.avgCheck),
    },
    noShowRate: {
      value: current.noShowRate,
      // For "rate" KPIs, delta is point-diff not percent-diff
      delta: round1(current.noShowRate - prior.noShowRate),
    },
    cancelRate: {
      value: current.cancelRate,
      delta: round1(current.cancelRate - prior.cancelRate),
    },
    periodDays,
  };
}

async function aggregatePeriod(ctx: AuthedContext, from: Date, to: Date) {
  // Single fetch for all reservations in the period, then in-memory split
  // for the various status buckets — keeps it to one round-trip.
  const reservations = await ctx.db.reservation.findMany({
    where: { startTime: { gte: from, lt: to } },
    select: {
      partySize: true,
      status: true,
      spendAmount: true,
    },
  });

  const total = reservations.length;
  let covers = 0;
  let revenue = 0;
  let completedWithSpend = 0;
  let noShows = 0;
  let cancellations = 0;

  for (const r of reservations) {
    if (r.status === ReservationStatus.COMPLETED || r.status === ReservationStatus.SEATED) {
      covers += r.partySize;
    }
    if (r.spendAmount != null) {
      revenue += r.spendAmount;
      completedWithSpend += 1;
    }
    if (r.status === ReservationStatus.NO_SHOW) noShows += 1;
    if (r.status === ReservationStatus.CANCELLED) cancellations += 1;
  }

  return {
    covers,
    revenue: round1(revenue),
    avgCheck: completedWithSpend > 0 ? round1(revenue / completedWithSpend) : 0,
    noShowRate: pct(noShows, total),
    cancelRate: pct(cancellations, total),
  };
}

function deltaPct(current: number, prior: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------
// 2. Time series — covers + revenue per day
// ---------------------------------------------------------------------

export type TimeSeriesPoint = {
  date: string; // ISO date (YYYY-MM-DD)
  covers: number;
  revenue: number;
};

export async function getTimeSeries(ctx: AuthedContext, days = 90): Promise<TimeSeriesPoint[]> {
  requirePermission(ctx, "analytics.view");

  const from = daysAgo(days);
  const reservations = await ctx.db.reservation.findMany({
    where: {
      startTime: { gte: from },
      status: { in: [ReservationStatus.COMPLETED, ReservationStatus.SEATED] },
    },
    select: { startTime: true, partySize: true, spendAmount: true },
  });

  // Build a dense series so the chart has no gaps
  const buckets = new Map<string, { covers: number; revenue: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    buckets.set(d.toISOString().slice(0, 10), { covers: 0, revenue: 0 });
  }
  for (const r of reservations) {
    const key = startOfDay(r.startTime).toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    b.covers += r.partySize;
    b.revenue += r.spendAmount ?? 0;
  }
  return [...buckets.entries()].map(([date, b]) => ({
    date,
    covers: b.covers,
    revenue: round1(b.revenue),
  }));
}

// ---------------------------------------------------------------------
// 3. Service window heatmap — day-of-week × hour
// ---------------------------------------------------------------------

export type HeatmapCell = {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  hour: number; // 0..23
  covers: number;
  reservations: number;
};

export async function getServiceHeatmap(ctx: AuthedContext, days = 60): Promise<HeatmapCell[]> {
  requirePermission(ctx, "analytics.view");

  const from = daysAgo(days);
  const [reservations, tenant] = await Promise.all([
    ctx.db.reservation.findMany({
      where: {
        startTime: { gte: from },
        status: { in: [ReservationStatus.COMPLETED, ReservationStatus.SEATED] },
      },
      select: { startTime: true, partySize: true },
    }),
    ctx.db.tenant.findFirst({ select: { timezone: true } }),
  ]);

  // Phase 9: bucket in the tenant's local timezone so an 8pm NYC reservation
  // lands in the 8pm column on the heatmap, not the 1am UTC column.
  const tz = tenant?.timezone ?? "America/New_York";
  const grid = new Map<string, HeatmapCell>();
  for (const r of reservations) {
    const { dayOfWeek, hour } = toLocalParts(r.startTime, tz);
    const key = `${dayOfWeek}-${hour}`;
    const cell = grid.get(key);
    if (cell) {
      cell.covers += r.partySize;
      cell.reservations += 1;
    } else {
      grid.set(key, { dayOfWeek, hour, covers: r.partySize, reservations: 1 });
    }
  }
  return [...grid.values()];
}

/**
 * Resolve a UTC instant into the day-of-week + hour-of-day in the given
 * IANA timezone. Uses `Intl.DateTimeFormat` parts — no extra dependency.
 */
function toLocalParts(d: Date, timeZone: string): { dayOfWeek: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  // Intl returns "24" at midnight in some locales — normalise.
  const hour = Number(hourStr) % 24;
  return { dayOfWeek: weekdayMap[weekday] ?? 0, hour };
}

// ---------------------------------------------------------------------
// 4. Source breakdown
// ---------------------------------------------------------------------

export type SourceSlice = {
  source: ReservationSource;
  count: number;
  percent: number;
};

export async function getSourceBreakdown(ctx: AuthedContext, days = 30): Promise<SourceSlice[]> {
  requirePermission(ctx, "analytics.view");

  const from = daysAgo(days);
  const grouped = await ctx.db.reservation.groupBy({
    by: ["source"],
    where: { startTime: { gte: from } },
    _count: { _all: true },
  });
  const total = grouped.reduce((s, g) => s + g._count._all, 0);
  return grouped
    .map((g) => ({
      source: g.source,
      count: g._count._all,
      percent: pct(g._count._all, total),
    }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------
// 5. Top guests, top tables
// ---------------------------------------------------------------------

export async function getTopGuests(ctx: AuthedContext, limit = 8) {
  requirePermission(ctx, "analytics.view");
  return ctx.db.guest.findMany({
    where: { totalVisits: { gt: 0 } },
    orderBy: [{ totalSpend: "desc" }, { totalVisits: "desc" }],
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      totalVisits: true,
      totalSpend: true,
      vipStatus: true,
    },
  });
}

export async function getTopTables(ctx: AuthedContext, days = 90, limit = 8) {
  requirePermission(ctx, "analytics.view");
  const from = daysAgo(days);

  const grouped = await ctx.db.reservation.groupBy({
    by: ["tableId"],
    where: {
      startTime: { gte: from },
      status: { in: [ReservationStatus.COMPLETED, ReservationStatus.SEATED] },
      tableId: { not: null },
    },
    _count: { _all: true },
    _sum: { partySize: true, spendAmount: true },
  });

  const tableIds = grouped.map((g) => g.tableId).filter(Boolean) as string[];
  const tables = await ctx.db.table.findMany({
    where: { id: { in: tableIds } },
    select: { id: true, name: true, section: { select: { name: true } } },
  });
  const tableById = new Map(tables.map((t) => [t.id, t]));

  return grouped
    .sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))
    .slice(0, limit)
    .map((g) => {
      const t = tableById.get(g.tableId!);
      return {
        tableId: g.tableId!,
        label: t?.name ?? "—",
        section: t?.section?.name ?? null,
        turns: g._count._all,
        covers: g._sum.partySize ?? 0,
        revenue: round1(g._sum.spendAmount ?? 0),
      };
    });
}

// ---------------------------------------------------------------------
// 6. Cohort retention — the showcase chart
// ---------------------------------------------------------------------

export type CohortRow = {
  cohortMonth: string; // YYYY-MM (when the guest's first visit was)
  cohortSize: number;
  retention: Array<{ monthOffset: number; returners: number; percent: number }>;
};

export async function getCohortRetention(
  ctx: AuthedContext,
  cohortCount = 6,
): Promise<CohortRow[]> {
  requirePermission(ctx, "analytics.view");

  // Pull every completed reservation grouped by guest with a `firstVisitAt`
  // anchor. cohort = first-visit YYYY-MM bucket; retention[n] = % who came
  // back in month n after their first.
  const now = new Date();
  const earliestCohort = new Date(now.getFullYear(), now.getMonth() - (cohortCount - 1), 1);

  // 1. Find all guests whose firstVisitAt falls within the cohort window
  const guests = await ctx.db.guest.findMany({
    where: {
      firstVisitAt: { gte: earliestCohort },
    },
    select: {
      id: true,
      firstVisitAt: true,
      reservations: {
        where: { status: ReservationStatus.COMPLETED },
        select: { startTime: true },
      },
    },
  });

  // 2. Bucket by cohort month, then for each guest record which month-offsets
  //    they came back in.
  const cohortMap = new Map<
    string,
    { size: number; returners: Map<number, Set<string>> }
  >();

  for (const g of guests) {
    if (!g.firstVisitAt) continue;
    const cohortKey = monthKey(g.firstVisitAt);
    if (!cohortMap.has(cohortKey)) {
      cohortMap.set(cohortKey, { size: 0, returners: new Map() });
    }
    const entry = cohortMap.get(cohortKey)!;
    entry.size += 1;
    for (const r of g.reservations) {
      const offset = monthDiff(g.firstVisitAt, r.startTime);
      if (offset < 0) continue; // shouldn't happen but be safe
      if (!entry.returners.has(offset)) entry.returners.set(offset, new Set());
      entry.returners.get(offset)!.add(g.id);
    }
  }

  // 3. Render the rows in chronological order, oldest cohort first
  const rows: CohortRow[] = [];
  for (let i = cohortCount - 1; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(month);
    const entry = cohortMap.get(key);
    const size = entry?.size ?? 0;
    const maxOffset = i; // how many months we can see retention for
    const retention: CohortRow["retention"] = [];
    for (let o = 0; o <= maxOffset; o++) {
      const returners = entry?.returners.get(o)?.size ?? 0;
      retention.push({
        monthOffset: o,
        returners,
        percent: size > 0 ? Math.round((returners / size) * 100) : 0,
      });
    }
    rows.push({ cohortMonth: key, cohortSize: size, retention });
  }
  return rows;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

// ---------------------------------------------------------------------
// 7. Loyalty + marketing pulse (small summary cards)
// ---------------------------------------------------------------------

export async function getLoyaltyPulse(ctx: AuthedContext, days = 30) {
  requirePermission(ctx, "analytics.view");
  const from = daysAgo(days);
  const [earned, redeemed, activeAccounts, totalAccounts, tierGrouped] = await Promise.all([
    ctx.db.loyaltyTransaction.aggregate({
      where: { createdAt: { gte: from }, type: "EARN" },
      _sum: { points: true },
    }),
    ctx.db.loyaltyTransaction.aggregate({
      where: { createdAt: { gte: from }, type: "REDEEM" },
      _sum: { points: true },
    }),
    ctx.db.loyaltyAccount.count({
      where: { guest: { lastVisitAt: { gte: from } } },
    }),
    ctx.db.loyaltyAccount.count(),
    ctx.db.loyaltyAccount.groupBy({
      by: ["tierId"],
      _count: { _all: true },
    }),
  ]);
  const tierIds = tierGrouped.map((g) => g.tierId).filter(Boolean) as string[];
  const tiers = await ctx.db.loyaltyTier.findMany({
    where: { id: { in: tierIds } },
    select: { id: true, name: true, color: true },
  });
  const tierById = new Map(tiers.map((t) => [t.id, t]));
  return {
    pointsEarned: earned._sum.points ?? 0,
    pointsRedeemed: Math.abs(redeemed._sum.points ?? 0),
    activeAccounts,
    totalAccounts,
    tierBreakdown: tierGrouped
      .filter((g) => g.tierId)
      .map((g) => ({
        tierId: g.tierId!,
        name: tierById.get(g.tierId!)?.name ?? "—",
        color: tierById.get(g.tierId!)?.color ?? null,
        count: g._count._all,
      })),
  };
}

export async function getMarketingPulse(ctx: AuthedContext, days = 30) {
  requirePermission(ctx, "analytics.view");
  const from = daysAgo(days);
  const campaigns = await ctx.db.campaign.findMany({
    where: { sentAt: { gte: from }, status: "SENT" },
    select: {
      id: true,
      name: true,
      sentCount: true,
      deliveredCount: true,
      openedCount: true,
      clickedCount: true,
    },
  });
  const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
  const totalDelivered = campaigns.reduce((s, c) => s + c.deliveredCount, 0);
  const totalOpened = campaigns.reduce((s, c) => s + c.openedCount, 0);
  const totalClicked = campaigns.reduce((s, c) => s + c.clickedCount, 0);
  return {
    campaignsSent: campaigns.length,
    messagesSent: totalSent,
    openRate: pct(totalOpened, totalDelivered),
    clickRate: pct(totalClicked, totalDelivered),
  };
}
