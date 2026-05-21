"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, X, Gift } from "lucide-react";
import {
  createRewardAction,
  updateRewardAction,
} from "@/server/actions/loyalty.actions";
import { cn } from "@/lib/utils";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  isActive: boolean;
};

export function RewardsPanel({
  rewards,
  redemptionRateUsd,
  canManage,
}: {
  rewards: Reward[];
  redemptionRateUsd: number;
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {rewards.length === 0 && !adding ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Gift className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No rewards yet. Give guests something to look forward to.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rewards.map((r) =>
            editingId === r.id ? (
              <RewardForm
                key={r.id}
                mode="edit"
                reward={r}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <RewardRow
                key={r.id}
                reward={r}
                redemptionRateUsd={redemptionRateUsd}
                canManage={canManage}
                onEdit={() => setEditingId(r.id)}
              />
            ),
          )}
          {adding ? <RewardForm mode="create" onClose={() => setAdding(false)} /> : null}
        </ul>
      )}

      {canManage && !adding ? (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border bg-card/50 px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add a reward
        </button>
      ) : null}
    </div>
  );
}

function RewardRow({
  reward,
  redemptionRateUsd,
  canManage,
  onEdit,
}: {
  reward: Reward;
  redemptionRateUsd: number;
  canManage: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const dollarValue = reward.pointsCost * redemptionRateUsd;

  function toggleActive() {
    start(async () => {
      const res = await updateRewardAction(reward.id, { isActive: !reward.isActive });
      if (res.ok) {
        toast.success(reward.isActive ? "Reward hidden" : "Reward activated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-lg border bg-card p-4",
        !reward.isActive && "opacity-60",
      )}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Gift className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {reward.name}
          {!reward.isActive ? (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              hidden
            </span>
          ) : null}
        </p>
        {reward.description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{reward.description}</p>
        ) : null}
      </div>
      <div className="text-right">
        <p className="font-mono text-sm tabular-nums">
          {reward.pointsCost.toLocaleString()}{" "}
          <span className="text-[10px] text-muted-foreground">pts</span>
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          ≈ ${dollarValue.toFixed(2)}
        </p>
      </div>
      {canManage ? (
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={toggleActive}
            disabled={pending}
            className="rounded px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title={reward.isActive ? "Hide" : "Show"}
          >
            {reward.isActive ? "Hide" : "Show"}
          </button>
        </div>
      ) : null}
    </li>
  );
}

function RewardForm({
  mode,
  reward,
  onClose,
}: {
  mode: "create" | "edit";
  reward?: Reward;
  onClose: () => void;
}) {
  const router = useRouter();
  const [submitting, start] = useTransition();
  const [name, setName] = useState(reward?.name ?? "");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [pointsCost, setPointsCost] = useState(reward?.pointsCost ?? 500);

  function submit() {
    start(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        pointsCost,
        isActive: reward?.isActive ?? true,
      };
      const res =
        mode === "create"
          ? await createRewardAction(payload)
          : await updateRewardAction(reward!.id, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Reward created" : "Reward updated");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {mode === "create" ? "New reward" : "Edit reward"}
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 space-y-2">
        <input
          autoFocus
          placeholder="Reward name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Points cost
          <input
            type="number"
            min={1}
            value={pointsCost}
            onChange={(e) => setPointsCost(Number(e.target.value))}
            className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          onClick={submit}
          disabled={!name.trim() || submitting}
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground transition hover:bg-primary/90",
            (!name.trim() || submitting) && "opacity-50",
          )}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {mode === "create" ? "Create reward" : "Save changes"}
        </button>
      </div>
    </li>
  );
}
