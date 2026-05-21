"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import {
  createTierAction,
  updateTierAction,
  deleteTierAction,
} from "@/server/actions/loyalty.actions";
import { cn } from "@/lib/utils";

type Tier = {
  id: string;
  name: string;
  minLifetimePoints: number;
  multiplier: number;
  perks: string[];
  color: string | null;
  displayOrder: number;
};

export function TiersPanel({ tiers, canManage }: { tiers: Tier[]; canManage: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {tiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No tiers yet. Tiers reward your most loyal guests with multipliers and perks.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) =>
            editingId === tier.id ? (
              <TierForm
                key={tier.id}
                mode="edit"
                tier={tier}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <TierCard
                key={tier.id}
                tier={tier}
                canManage={canManage}
                onEdit={() => setEditingId(tier.id)}
              />
            ),
          )}
          {adding ? <TierForm mode="create" onClose={() => setAdding(false)} /> : null}
        </div>
      )}

      {canManage && !adding ? (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border bg-card/50 px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add a tier
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------

function TierCard({
  tier,
  canManage,
  onEdit,
}: {
  tier: Tier;
  canManage: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove() {
    if (!confirm(`Delete tier "${tier.name}"? Guests at this tier will drop to the next one down.`)) return;
    start(async () => {
      const res = await deleteTierAction(tier.id);
      if (res.ok) {
        toast.success("Tier deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div
      className="relative rounded-lg border bg-card p-5"
      style={{ borderColor: tier.color ?? "hsl(var(--border))" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className="font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: tier.color ?? "hsl(var(--muted-foreground))" }}
          >
            {tier.name}
          </p>
          <p className="mt-1 font-display text-2xl tracking-tight">
            {tier.minLifetimePoints.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground"> pts</span>
          </p>
          {tier.multiplier !== 1 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tier.multiplier}× points multiplier
            </p>
          ) : null}
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
              onClick={remove}
              disabled={pending}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>
      {tier.perks.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs">
          {tier.perks.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground">{p}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------

function TierForm({
  mode,
  tier,
  onClose,
}: {
  mode: "create" | "edit";
  tier?: Tier;
  onClose: () => void;
}) {
  const router = useRouter();
  const [submitting, start] = useTransition();
  const [name, setName] = useState(tier?.name ?? "");
  const [minLifetimePoints, setMinPoints] = useState(tier?.minLifetimePoints ?? 0);
  const [multiplier, setMultiplier] = useState(tier?.multiplier ?? 1);
  const [color, setColor] = useState(tier?.color ?? "#CD7F32");
  const [perks, setPerks] = useState<string[]>(tier?.perks ?? []);
  const [perkInput, setPerkInput] = useState("");

  function submit() {
    const payload = {
      name: name.trim(),
      minLifetimePoints,
      multiplier,
      color,
      perks,
      displayOrder: tier?.displayOrder ?? 0,
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createTierAction(payload)
          : await updateTierAction(tier!.id, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Tier created" : "Tier updated");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {mode === "create" ? "New tier" : "Edit tier"}
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <input
          autoFocus
          placeholder="Tier name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Min points
            <input
              type="number"
              value={minLifetimePoints}
              onChange={(e) => setMinPoints(Number(e.target.value))}
              min={0}
              className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Multiplier
            <input
              type="number"
              step="0.05"
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
              min={0}
              className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 rounded border border-input bg-card p-0"
          />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {color}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Perks</p>
          {perks.length > 0 ? (
            <ul className="space-y-1">
              {perks.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded bg-card px-2 py-1 text-xs"
                >
                  {p}
                  <button
                    onClick={() => setPerks(perks.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-1.5">
            <input
              value={perkInput}
              onChange={(e) => setPerkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (perkInput.trim()) {
                    setPerks([...perks, perkInput.trim()]);
                    setPerkInput("");
                  }
                }
              }}
              placeholder="Add a perk and press Enter"
              className="h-8 flex-1 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!name.trim() || submitting}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground transition hover:bg-primary/90",
            (!name.trim() || submitting) && "opacity-50",
          )}
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {mode === "create" ? "Create tier" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
