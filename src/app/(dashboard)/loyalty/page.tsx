import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, Target, Gift, Activity } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import {
  getOrCreateProgram,
  getLeaderboard,
  recentTransactions,
} from "@/server/services/loyalty.service";
import { formatRelative, initials } from "@/lib/format";
import { ProgramConfigForm } from "@/components/loyalty/program-config-form";
import { TiersPanel } from "@/components/loyalty/tiers-panel";
import { RewardsPanel } from "@/components/loyalty/rewards-panel";

export const metadata = { title: "Loyalty" };
export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "loyalty.view")) redirect("/dashboard");

  const [program, leaderboard, recent] = await Promise.all([
    getOrCreateProgram(ctx),
    getLeaderboard(ctx, 10),
    recentTransactions(ctx, 15),
  ]);

  const canManage = hasPermission(ctx.role, "loyalty.manage");

  return (
    <div className="mx-auto max-w-[1200px] animate-fade-in space-y-14">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Relationships
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">{program.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {program.description ??
            "Configure how guests earn points, define tiers, and curate the reward catalogue."}
        </p>
        {!program.isActive ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Program is inactive — turn it on below to start awarding points on completed reservations.
          </p>
        ) : null}
      </div>

      {/* 01 — Program config */}
      <SectionHeader number="01" title="Program rules" icon={<Target className="h-4 w-4" />} />
      <ProgramConfigForm
        program={{
          name: program.name,
          description: program.description,
          isActive: program.isActive,
          pointsPerDollar: program.pointsPerDollar,
          pointsPerVisit: program.pointsPerVisit,
          redemptionRate: program.redemptionRate,
        }}
        canManage={canManage}
      />

      {/* 02 — Tiers */}
      <SectionHeader number="02" title="Tiers" icon={<Trophy className="h-4 w-4" />} />
      <TiersPanel
        tiers={program.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          minLifetimePoints: t.minLifetimePoints,
          multiplier: t.multiplier,
          perks: t.perks,
          color: t.color,
          displayOrder: t.displayOrder,
        }))}
        canManage={canManage}
      />

      {/* 03 — Rewards */}
      <SectionHeader number="03" title="Reward catalogue" icon={<Gift className="h-4 w-4" />} />
      <RewardsPanel
        rewards={program.rewards.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          pointsCost: r.pointsCost,
          isActive: r.isActive,
        }))}
        redemptionRateUsd={program.redemptionRate}
        canManage={canManage}
      />

      {/* Side-by-side: Leaderboard + Recent activity */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeader number="04" title="Top guests" icon={<Trophy className="h-4 w-4" />} compact />
          {leaderboard.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No accounts yet. They'll show up here as guests visit.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {leaderboard.map((a, idx) => (
                <li key={a.id}>
                  <Link
                    href={`/guests/${a.guest.id}`}
                    className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 transition hover:bg-secondary"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono text-xs tabular-nums text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-mono text-[9px] text-primary">
                        {initials(`${a.guest.firstName} ${a.guest.lastName ?? ""}`)}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {a.guest.firstName} {a.guest.lastName ?? ""}
                        </p>
                        {a.tier ? (
                          <span
                            className="font-mono text-[9px] uppercase tracking-wider"
                            style={{ color: a.tier.color ?? "#888" }}
                          >
                            {a.tier.name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="font-mono text-sm tabular-nums">
                      {a.lifetimePoints.toLocaleString()}{" "}
                      <span className="text-[10px] text-muted-foreground">pts</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <SectionHeader number="05" title="Recent activity" icon={<Activity className="h-4 w-4" />} compact />
          {recent.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recent.map((t) => {
                const name = `${t.account.guest.firstName} ${t.account.guest.lastName ?? ""}`.trim();
                const positive = t.points > 0;
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <Link
                          href={`/guests/${t.account.guest.id}`}
                          className="font-medium hover:underline"
                        >
                          {name}
                        </Link>
                        {t.description ? (
                          <span className="text-muted-foreground"> · {t.description}</span>
                        ) : null}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {formatRelative(t.createdAt)} · {t.type.toLowerCase()}
                      </p>
                    </div>
                    <p
                      className={`font-mono text-sm tabular-nums ${positive ? "text-success" : "text-destructive"}`}
                    >
                      {positive ? "+" : ""}
                      {t.points.toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  number,
  title,
  icon,
  compact,
}: {
  number: string;
  title: string;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <header className={`flex items-baseline gap-3 ${compact ? "mb-3" : "border-b border-border pb-3"}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {number}
      </span>
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
    </header>
  );
}
