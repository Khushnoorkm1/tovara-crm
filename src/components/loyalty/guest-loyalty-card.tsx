"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  Minus,
  Gift,
  TrendingUp,
  Loader2,
  X,
  Trophy,
} from "lucide-react";
import { LoyaltyTransactionType } from "@prisma/client";
import {
  adjustPointsAction,
  redeemRewardAction,
} from "@/server/actions/loyalty.actions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tier = {
  id: string;
  name: string;
  minLifetimePoints: number;
  multiplier: number;
  color: string | null;
  perks: string[];
};

type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  isActive: boolean;
};

type Transaction = {
  id: string;
  type: LoyaltyTransactionType;
  points: number;
  description: string | null;
  createdAt: string;
};

type LoyaltyCardProps = {
  guestId: string;
  programName: string;
  isActive: boolean;
  currentPoints: number;
  lifetimePoints: number;
  tier: Tier | null;
  nextTier: Tier | null;
  rewards: Reward[];
  recentTransactions: Transaction[];
  canManage: boolean;
};

export function GuestLoyaltyCard(props: LoyaltyCardProps) {
  const {
    guestId,
    programName,
    isActive,
    currentPoints,
    lifetimePoints,
    tier,
    nextTier,
    rewards,
    recentTransactions,
    canManage,
  } = props;

  const tierColor = tier?.color ?? "#888";
  const pointsToNextTier = nextTier ? Math.max(0, nextTier.minLifetimePoints - lifetimePoints) : 0;
  const progressPct = nextTier
    ? Math.min(
        100,
        ((lifetimePoints - (tier?.minLifetimePoints ?? 0)) /
          (nextTier.minLifetimePoints - (tier?.minLifetimePoints ?? 0))) *
          100,
      )
    : 100;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Header with tier color band */}
      <div
        className="border-b border-border px-5 py-4"
        style={{ background: `linear-gradient(135deg, ${tierColor}22, transparent)` }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {programName}
          </p>
          {!isActive ? (
            <span className="font-mono text-[9px] uppercase tracking-wider text-warning">
              Program off
            </span>
          ) : null}
        </div>

        {tier ? (
          <div className="mt-2 flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: tierColor }} />
            <p className="font-display text-xl tracking-tight" style={{ color: tierColor }}>
              {tier.name}
            </p>
            {tier.multiplier > 1 ? (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                style={{ background: `${tierColor}22`, color: tierColor }}
              >
                {tier.multiplier}× pts
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 font-display text-xl tracking-tight text-muted-foreground">
            Unranked
          </p>
        )}
      </div>

      {/* Points + progress */}
      <div className="px-5 py-5">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Current points" value={currentPoints.toLocaleString()} />
          <Stat label="Lifetime points" value={lifetimePoints.toLocaleString()} />
        </div>

        {nextTier ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="mr-1 inline h-3 w-3" />
                {pointsToNextTier.toLocaleString()} pts to{" "}
                <span style={{ color: nextTier.color ?? undefined }}>{nextTier.name}</span>
              </p>
              <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {Math.round(progressPct)}%
              </p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  background: nextTier.color ?? "hsl(var(--primary))",
                }}
              />
            </div>
          </div>
        ) : tier ? (
          <p className="mt-5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Highest tier reached
          </p>
        ) : null}

        {tier && tier.perks.length > 0 ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Active perks
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {tier.perks.map((p, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span
                    className="mt-1 h-1 w-1 flex-shrink-0 rounded-full"
                    style={{ background: tierColor }}
                  />
                  <span className="text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Rewards */}
      {rewards.length > 0 && canManage ? (
        <div className="border-t border-border px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Redeem
          </p>
          <ul className="mt-2 space-y-1.5">
            {rewards.filter((r) => r.isActive).map((r) => (
              <RewardRedeemButton
                key={r.id}
                guestId={guestId}
                reward={r}
                canAfford={currentPoints >= r.pointsCost}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Recent activity */}
      {recentTransactions.length > 0 ? (
        <div className="border-t border-border px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Recent activity
          </p>
          <ul className="mt-2 space-y-1.5">
            {recentTransactions.slice(0, 5).map((t) => {
              const positive = t.points > 0;
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{t.description ?? t.type.toLowerCase()}</p>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {formatRelative(t.createdAt)} · {t.type.toLowerCase()}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "font-mono tabular-nums",
                      positive ? "text-success" : "text-destructive",
                    )}
                  >
                    {positive ? "+" : ""}
                    {t.points.toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Manual adjust */}
      {canManage ? (
        <div className="border-t border-border px-5 py-4">
          <ManualAdjustForm guestId={guestId} />
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function RewardRedeemButton({
  guestId,
  reward,
  canAfford,
}: {
  guestId: string;
  reward: Reward;
  canAfford: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function redeem() {
    if (!confirm(`Redeem "${reward.name}" for ${reward.pointsCost} points?`)) return;
    start(async () => {
      const res = await redeemRewardAction({ guestId, rewardId: reward.id });
      if (res.ok) {
        toast.success(`Redeemed — code ${res.data.code}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li>
      <button
        onClick={redeem}
        disabled={!canAfford || pending}
        className={cn(
          "group flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition",
          canAfford
            ? "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
            : "cursor-not-allowed border-dashed border-border bg-card/50 opacity-50",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm">
            <Gift className="h-3 w-3 text-muted-foreground" />
            {reward.name}
          </p>
          {reward.description ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{reward.description}</p>
          ) : null}
        </div>
        <p className="ml-3 flex-shrink-0 font-mono text-xs tabular-nums">
          {reward.pointsCost.toLocaleString()}
        </p>
      </button>
    </li>
  );
}

function ManualAdjustForm({ guestId }: { guestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState(100);
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const signed = direction === "add" ? Math.abs(points) : -Math.abs(points);
    if (signed === 0 || !description.trim()) return;
    start(async () => {
      const res = await adjustPointsAction({
        guestId,
        points: signed,
        description: description.trim(),
      });
      if (res.ok) {
        toast.success("Adjusted");
        setOpen(false);
        setDescription("");
        setPoints(100);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-border bg-card/50 px-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
        Manual adjust
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Adjust points
        </p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-2.5 space-y-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setDirection("add")}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border text-xs transition",
              direction === "add"
                ? "border-success bg-success/10 text-success"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            <Plus className="h-3 w-3" /> Grant
          </button>
          <button
            type="button"
            onClick={() => setDirection("remove")}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border text-xs transition",
              direction === "remove"
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            <Minus className="h-3 w-3" /> Remove
          </button>
        </div>
        <input
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Reason (required)"
          className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={submit}
          disabled={!description.trim() || pending}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Apply adjustment
        </button>
      </div>
    </div>
  );
}
