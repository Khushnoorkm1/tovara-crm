"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { deleteGuestAction } from "@/server/actions/guest.actions";

export function GuestDeleteButton({
  guestId,
  guestName,
}: {
  guestId: string;
  guestName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 text-xs font-medium text-destructive transition hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete this guest
      </button>
    );
  }

  function confirm() {
    start(async () => {
      const res = await deleteGuestAction(guestId);
      if (res.ok) {
        toast.success("Guest deleted");
        router.push("/guests");
      } else {
        toast.error(res.error);
      }
    });
  }

  const matches = typed === guestName.trim();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        To confirm, type <span className="font-mono text-foreground">{guestName.trim()}</span> below.
      </p>
      <input
        autoFocus
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="h-10 w-full max-w-md rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={!matches || pending}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Permanently delete
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          className="px-3 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
