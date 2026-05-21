"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus, Loader2, Tag as TagIcon } from "lucide-react";
import {
  assignGuestTagAction,
  unassignGuestTagAction,
  createGuestTagAction,
} from "@/server/actions/guest-tag.actions";
import { cn } from "@/lib/utils";

type Tag = { id: string; name: string; color: string | null; isAutoTag: boolean };

export function GuestTagsPanel({
  guestId,
  assignedTags,
  allTags,
  canManage,
}: {
  guestId: string;
  assignedTags: Tag[];
  allTags: Tag[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setCreatingTag(false);
      }
    }
    if (pickerOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  const assignedIds = new Set(assignedTags.map((t) => t.id));
  const available = allTags.filter((t) => !assignedIds.has(t.id));

  function assign(tagId: string) {
    setPickerOpen(false);
    start(async () => {
      const res = await assignGuestTagAction({ guestId, tagId });
      if (res.ok) {
        toast.success("Tag added");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function unassign(tagId: string) {
    start(async () => {
      const res = await unassignGuestTagAction({ guestId, tagId });
      if (res.ok) {
        toast.success("Tag removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assignedTags.length === 0 && !canManage ? (
        <p className="text-xs text-muted-foreground">No tags.</p>
      ) : null}

      {assignedTags.map((tag) => (
        <span
          key={tag.id}
          className="group inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: tag.color ?? "#3B82F6" }}
          />
          <span>{tag.name}</span>
          {tag.isAutoTag ? (
            <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
              auto
            </span>
          ) : canManage ? (
            <button
              onClick={() => unassign(tag.id)}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}

      {canManage ? (
        <div ref={ref} className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            disabled={pending}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs transition",
              pickerOpen
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Plus className="h-3 w-3" />
            Add tag
          </button>

          {pickerOpen ? (
            <div className="absolute left-0 top-9 z-20 w-64 rounded-md border border-border bg-popover shadow-lg">
              {creatingTag ? (
                <NewTagInline
                  onCancel={() => setCreatingTag(false)}
                  onCreated={(tagId) => {
                    setCreatingTag(false);
                    assign(tagId);
                  }}
                />
              ) : (
                <>
                  {available.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">
                      All tags already assigned.
                    </p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {available.map((tag) => (
                        <li key={tag.id}>
                          <button
                            onClick={() => assign(tag.id)}
                            disabled={pending}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-secondary"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: tag.color ?? "#3B82F6" }}
                            />
                            <span className="flex-1">{tag.name}</span>
                            {tag.isAutoTag ? (
                              <span className="font-mono text-[9px] uppercase text-muted-foreground">
                                auto
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="border-t border-border p-1">
                    <button
                      onClick={() => setCreatingTag(true)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <TagIcon className="h-3 w-3" />
                      Create a new tag…
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {pending ? <Loader2 className="ml-2 h-3 w-3 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}

function NewTagInline({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (tagId: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#B5462E");
  const [submitting, start] = useTransition();

  function submit() {
    if (!name.trim()) return;
    start(async () => {
      const res = await createGuestTagAction({ name: name.trim(), color });
      if (res.ok) {
        toast.success("Tag created");
        onCreated(res.data.id);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-2 p-3">
      <input
        type="text"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tag name"
        className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-7 w-12 rounded border border-input bg-card p-0"
        />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {color}
        </span>
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          onClick={onCancel}
          className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!name.trim() || submitting}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Create
        </button>
      </div>
    </div>
  );
}
