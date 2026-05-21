"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type TagSummary = {
  id: string;
  name: string;
  color: string | null;
  isAutoTag: boolean;
  count: number;
};

const VIP_FILTERS = [
  { label: "All", value: null },
  { label: "VIPs only", value: "vip" },
  { label: "Regular", value: "regular" },
];

export function GuestFilters({ tags }: { tags: TagSummary[] }) {
  const params = useSearchParams();
  const currentVip = params.get("vip");
  const currentTags = (params.get("tag") ?? "").split(",").filter(Boolean);

  function buildVipHref(value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("vip", value);
    else next.delete("vip");
    next.delete("page");
    return `?${next.toString()}`;
  }

  function buildTagHref(tagId: string) {
    const next = new URLSearchParams(params.toString());
    const set = new Set(currentTags);
    if (set.has(tagId)) set.delete(tagId);
    else set.add(tagId);
    if (set.size === 0) next.delete("tag");
    else next.set("tag", [...set].join(","));
    next.delete("page");
    return `?${next.toString()}`;
  }

  return (
    <div className="space-y-2">
      {/* VIP filter row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Status
        </span>
        {VIP_FILTERS.map((f) => {
          const active = (currentVip ?? null) === f.value;
          return (
            <Link
              key={f.label}
              href={buildVipHref(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Tag filter row */}
      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Tags
          </span>
          {tags.map((tag) => {
            const active = currentTags.includes(tag.id);
            return (
              <Link
                key={tag.id}
                href={buildTagHref(tag.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color ?? "#3B82F6" }}
                />
                <span>{tag.name}</span>
                <span className="font-mono text-[9px] opacity-70">{tag.count}</span>
                {tag.isAutoTag ? (
                  <span className="font-mono text-[8px] uppercase opacity-60">auto</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
