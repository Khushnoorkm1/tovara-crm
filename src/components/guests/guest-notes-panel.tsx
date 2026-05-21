"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pin, PinOff, Trash2, Plus, Loader2, StickyNote } from "lucide-react";
import {
  createGuestNoteAction,
  deleteGuestNoteAction,
  updateGuestNoteAction,
} from "@/server/actions/guest-note.actions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  authorName: string | null;
  authorId: string | null;
};

export function GuestNotesPanel({
  guestId,
  notes,
  currentUserId,
  canEditAny,
  canCreate,
}: {
  guestId: string;
  notes: Note[];
  currentUserId: string;
  canEditAny: boolean;
  canCreate: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const pinned = notes.filter((n) => n.isPinned);
  const others = notes.filter((n) => !n.isPinned);

  return (
    <div className="space-y-3">
      {canCreate ? (
        <>
          {adding ? (
            <NewNoteForm guestId={guestId} onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border bg-card/50 px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Add a note
            </button>
          )}
        </>
      ) : null}

      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <StickyNote className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No notes yet. Capture preferences, allergies, or context for next time.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pinned.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              guestId={guestId}
              canEdit={canEditAny || n.authorId === currentUserId}
            />
          ))}
          {pinned.length > 0 && others.length > 0 ? (
            <li className="my-3 flex items-center gap-2 px-1">
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Older
              </span>
              <span className="h-px flex-1 bg-border" />
            </li>
          ) : null}
          {others.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              guestId={guestId}
              canEdit={canEditAny || n.authorId === currentUserId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------

function NewNoteForm({
  guestId,
  onCancel,
  onSaved,
}: {
  guestId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, start] = useTransition();

  function submit() {
    if (!content.trim()) return;
    start(async () => {
      const res = await createGuestNoteAction({
        guestId,
        content: content.trim(),
        isPinned,
      });
      if (res.ok) {
        toast.success("Note added");
        setContent("");
        onSaved();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        autoFocus
        placeholder="Loves the corner banquette. Allergic to shellfish. Drinks a Negroni before dinner."
        className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input accent-primary"
          />
          Pin to top
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!content.trim() || submitting}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteCard({
  note,
  guestId,
  canEdit,
}: {
  note: Note;
  guestId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function togglePin() {
    start(async () => {
      const res = await updateGuestNoteAction(note.id, guestId, { isPinned: !note.isPinned });
      if (res.ok) {
        toast.success(note.isPinned ? "Note unpinned" : "Note pinned");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove() {
    if (!confirm("Delete this note?")) return;
    start(async () => {
      const res = await deleteGuestNoteAction(note.id, guestId);
      if (res.ok) {
        toast.success("Note deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li
      className={cn(
        "rounded-lg border p-4 transition",
        note.isPinned
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card",
      )}
    >
      <p className="whitespace-pre-wrap text-sm">{note.content}</p>
      <div className="mt-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {note.authorName ?? "system"} · {formatRelative(note.createdAt)}
          {note.isPinned ? " · pinned" : ""}
        </p>
        {canEdit ? (
          <div className="flex items-center gap-1">
            <button
              onClick={togglePin}
              disabled={pending}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              title={note.isPinned ? "Unpin" : "Pin"}
            >
              {note.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={remove}
              disabled={pending}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
