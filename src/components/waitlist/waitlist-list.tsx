"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Footprints, LogOut, Phone, Users, Loader2 } from "lucide-react";
import { WaitlistStatus } from "@prisma/client";
import { updateWaitlistStatusAction } from "@/server/actions/waitlist.actions";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

type WaitlistItem = {
  id: string;
  guestName: string;
  guestPhone: string | null;
  partySize: number;
  quotedWaitMinutes: number | null;
  status: WaitlistStatus;
  notes: string | null;
  joinedAt: string;
  notifiedAt: string | null;
  seatedAt: string | null;
  leftAt: string | null;
  guest: { id: string; firstName: string; lastName: string | null; vipStatus: string } | null;
};

export function WaitlistList({ items }: { items: WaitlistItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-16 text-center">
        <Users className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">Nobody's on the waitlist.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add walk-ins as they arrive — they'll show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <WaitlistRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function WaitlistRow({ item }: { item: WaitlistItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isVip = item.guest?.vipStatus === "VIP" || item.guest?.vipStatus === "CELEBRITY";
  const elapsed = elapsedMinutes(item.joinedAt);

  function transition(status: WaitlistStatus, msg: string) {
    start(async () => {
      const res = await updateWaitlistStatusAction(item.id, status);
      if (res.ok) {
        toast.success(msg);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li
      className={cn(
        "rounded-lg border bg-card p-5 transition",
        item.status === WaitlistStatus.NOTIFIED
          ? "border-warning/30 bg-warning/5"
          : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: guest + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-medium">{item.guestName}</p>
            {isVip ? (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
                VIP
              </span>
            ) : null}
            {item.status === WaitlistStatus.NOTIFIED ? (
              <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-warning ring-1 ring-warning/30">
                Notified
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Party of {item.partySize}
            </span>
            {item.guestPhone ? (
              <a href={`tel:${item.guestPhone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="h-3 w-3" />
                {formatPhone(item.guestPhone)}
              </a>
            ) : null}
            <span className="font-mono">
              Waiting {elapsed} min
              {item.quotedWaitMinutes ? ` of ${item.quotedWaitMinutes}` : ""}
            </span>
          </p>
          {item.notes ? (
            <p className="mt-2 text-xs italic text-muted-foreground">"{item.notes}"</p>
          ) : null}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-1.5">
          {item.status === WaitlistStatus.WAITING ? (
            <ActionBtn onClick={() => transition(WaitlistStatus.NOTIFIED, "Marked notified")} disabled={pending}>
              <Bell className="h-3 w-3" />
              Notify
            </ActionBtn>
          ) : null}
          <ActionBtn
            onClick={() => transition(WaitlistStatus.SEATED, "Marked seated")}
            disabled={pending}
            primary
          >
            <Footprints className="h-3 w-3" />
            Seat
          </ActionBtn>
          <ActionBtn
            onClick={() => transition(WaitlistStatus.LEFT, "Marked left")}
            disabled={pending}
            subtle
          >
            <LogOut className="h-3 w-3" />
            Left
          </ActionBtn>
        </div>
      </div>

      {pending ? (
        <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating…
        </p>
      ) : null}
    </li>
  );
}

function ActionBtn({
  onClick,
  disabled,
  primary,
  subtle,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  subtle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : subtle
          ? "text-muted-foreground hover:bg-secondary hover:text-foreground"
          : "border border-border text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function elapsedMinutes(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}
