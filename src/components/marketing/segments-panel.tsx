"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  RefreshCw,
  Users,
  Pencil,
  Loader2,
  X,
} from "lucide-react";
import {
  createSegmentAction,
  updateSegmentAction,
  deleteSegmentAction,
  previewSegmentAction,
  refreshSegmentAction,
} from "@/server/actions/marketing.actions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Segment = {
  id: string;
  name: string;
  description: string | null;
  rules: Record<string, unknown>;
  memberCount: number;
  updatedAt: string;
};

type TagLite = { id: string; name: string; color: string | null };
type TierLite = { id: string; name: string; color: string | null };

type RulesState = {
  vipStatus?: string[];
  tagIds?: string[];
  tagMode?: "any" | "all";
  loyaltyTierIds?: string[];
  minVisits?: number;
  daysSinceLastVisitMin?: number;
  marketingEmailOptIn?: boolean;
};

export function SegmentsPanel({
  segments,
  tags,
  tiers,
  canManage,
}: {
  segments: Segment[];
  tags: TagLite[];
  tiers: TierLite[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {segments.length === 0 && !adding ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Users className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No segments yet. Define an audience to send campaigns to.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {segments.map((s) =>
            editingId === s.id ? (
              <SegmentForm
                key={s.id}
                mode="edit"
                segment={s}
                tags={tags}
                tiers={tiers}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <SegmentRow
                key={s.id}
                segment={s}
                canManage={canManage}
                onEdit={() => setEditingId(s.id)}
              />
            ),
          )}
          {adding ? (
            <SegmentForm mode="create" tags={tags} tiers={tiers} onClose={() => setAdding(false)} />
          ) : null}
        </ul>
      )}

      {canManage && !adding ? (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border bg-card/50 px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          New segment
        </button>
      ) : null}
    </div>
  );
}

function SegmentRow({
  segment,
  canManage,
  onEdit,
}: {
  segment: Segment;
  canManage: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function refresh() {
    start(async () => {
      const res = await refreshSegmentAction(segment.id);
      if (res.ok) {
        toast.success(`Refreshed — ${res.data.count} guests`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove() {
    if (!confirm(`Delete segment "${segment.name}"?`)) return;
    start(async () => {
      const res = await deleteSegmentAction(segment.id);
      if (res.ok) {
        toast.success("Segment deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{segment.name}</p>
          {segment.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{segment.description}</p>
          ) : null}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {summarizeRules(segment.rules).map((r) => (
              <span key={r} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                {r}
              </span>
            ))}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="font-display text-xl tabular-nums">
            {segment.memberCount.toLocaleString()}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">guests</span>
          </p>
          {canManage ? (
            <div className="flex items-center gap-1">
              <button
                onClick={refresh}
                disabled={pending}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Refresh members"
              >
                <RefreshCw className={cn("h-3 w-3", pending && "animate-spin")} />
              </button>
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
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {formatRelative(segment.updatedAt)}
          </p>
        </div>
      </div>
    </li>
  );
}

function SegmentForm({
  mode,
  segment,
  tags,
  tiers,
  onClose,
}: {
  mode: "create" | "edit";
  segment?: Segment;
  tags: TagLite[];
  tiers: TierLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [submitting, start] = useTransition();
  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  const [rules, setRules] = useState<RulesState>(
    (segment?.rules as RulesState) ?? { tagMode: "any" },
  );
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Live preview on rules change (debounced via useEffect)
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreviewing(true);
      const res = await previewSegmentAction(rules);
      if (cancelled) return;
      setPreviewing(false);
      if (res.ok) setPreviewCount(res.data.count);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [rules]);

  function toggleArray<T extends string>(field: keyof RulesState, value: T) {
    setRules((prev) => {
      const list = ((prev[field] ?? []) as T[]).slice();
      const idx = list.indexOf(value);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(value);
      return { ...prev, [field]: list.length > 0 ? list : undefined };
    });
  }

  function submit() {
    const cleanRules = Object.fromEntries(
      Object.entries(rules).filter(([, v]) => {
        if (v == null) return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      }),
    );
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      rules: cleanRules,
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createSegmentAction(payload)
          : await updateSegmentAction(segment!.id, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Segment created" : "Segment saved");
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
          {mode === "create" ? "New segment" : "Edit segment"}
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <input
            autoFocus
            placeholder="Segment name"
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

          {/* VIP status */}
          <Group label="VIP status">
            {["NONE", "REGULAR", "VIP", "CELEBRITY"].map((v) => {
              const active = (rules.vipStatus ?? []).includes(v);
              return (
                <Chip
                  key={v}
                  active={active}
                  onClick={() => toggleArray("vipStatus", v)}
                >
                  {v.toLowerCase()}
                </Chip>
              );
            })}
          </Group>

          {/* Tags */}
          {tags.length > 0 ? (
            <Group
              label="Tags"
              aside={
                <select
                  value={rules.tagMode ?? "any"}
                  onChange={(e) =>
                    setRules({ ...rules, tagMode: e.target.value as "any" | "all" })
                  }
                  className="h-7 rounded border border-input bg-card px-1.5 font-mono text-[10px] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="any">match any</option>
                  <option value="all">match all</option>
                </select>
              }
            >
              {tags.map((t) => {
                const active = (rules.tagIds ?? []).includes(t.id);
                return (
                  <Chip
                    key={t.id}
                    active={active}
                    onClick={() => toggleArray("tagIds", t.id)}
                    color={t.color}
                  >
                    {t.name}
                  </Chip>
                );
              })}
            </Group>
          ) : null}

          {/* Loyalty tiers */}
          {tiers.length > 0 ? (
            <Group label="Loyalty tier">
              {tiers.map((tier) => {
                const active = (rules.loyaltyTierIds ?? []).includes(tier.id);
                return (
                  <Chip
                    key={tier.id}
                    active={active}
                    onClick={() => toggleArray("loyaltyTierIds", tier.id)}
                    color={tier.color}
                  >
                    {tier.name}
                  </Chip>
                );
              })}
            </Group>
          ) : null}

          {/* Numeric rules */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Group label="Min visits">
              <input
                type="number"
                min={0}
                value={rules.minVisits ?? ""}
                onChange={(e) =>
                  setRules({
                    ...rules,
                    minVisits: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="e.g. 3"
                className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Group>
            <Group label="Days since last visit ≥">
              <input
                type="number"
                min={0}
                value={rules.daysSinceLastVisitMin ?? ""}
                onChange={(e) =>
                  setRules({
                    ...rules,
                    daysSinceLastVisitMin: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="e.g. 60"
                className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Group>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={rules.marketingEmailOptIn === true}
              onChange={(e) =>
                setRules({
                  ...rules,
                  marketingEmailOptIn: e.target.checked ? true : undefined,
                })
              }
              className="h-3.5 w-3.5 accent-primary"
            />
            <span>Must be opted in to marketing email</span>
          </label>

          <button
            onClick={submit}
            disabled={!name.trim() || submitting}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
              (!name.trim() || submitting) && "opacity-50",
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "create" ? "Create segment" : "Save changes"}
          </button>
        </div>

        {/* Live preview */}
        <aside className="rounded-md border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Live preview
          </p>
          <p className="mt-2 font-display text-3xl tabular-nums">
            {previewing ? (
              <Loader2 className="inline h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              (previewCount ?? 0).toLocaleString()
            )}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {(previewCount ?? 0) === 1 ? "guest" : "guests"}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Updates as you tweak the rules.
          </p>
        </aside>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------

function Group({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        {aside}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string | null;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:bg-secondary",
      )}
    >
      {color ? (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      ) : null}
      {children}
    </button>
  );
}

function summarizeRules(rules: Record<string, unknown>): string[] {
  const out: string[] = [];
  const vips = rules.vipStatus as string[] | undefined;
  if (vips && vips.length) out.push(`vip: ${vips.join("/").toLowerCase()}`);
  const tagIds = rules.tagIds as string[] | undefined;
  if (tagIds && tagIds.length) out.push(`${tagIds.length} tag${tagIds.length === 1 ? "" : "s"}`);
  const tiers = rules.loyaltyTierIds as string[] | undefined;
  if (tiers && tiers.length) out.push(`${tiers.length} tier${tiers.length === 1 ? "" : "s"}`);
  if (rules.minVisits != null) out.push(`≥${rules.minVisits} visits`);
  if (rules.daysSinceLastVisitMin != null)
    out.push(`lapsed ≥${rules.daysSinceLastVisitMin}d`);
  if (rules.marketingEmailOptIn) out.push("email opt-in");
  return out.length > 0 ? out : ["all guests"];
}
