import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { listWaitlist } from "@/server/services/waitlist.service";
import { WaitlistList } from "@/components/waitlist/waitlist-list";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";

export const metadata = { title: "Waitlist" };
export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "waitlist.manage")) redirect("/dashboard");

  const items = await listWaitlist({ ctx });

  return (
    <div className="mx-auto max-w-[1100px] animate-fade-in">
      <Link
        href="/reservations"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to reservations
      </Link>

      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Service · Waitlist
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">Walk-ins & waitlist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {items.length === 0
            ? "Nobody's waiting right now."
            : `${items.length} ${items.length === 1 ? "party" : "parties"} waiting.`}
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <WaitlistList items={items.map(toJson)} />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Add walk-in
          </p>
          <div className="mt-3 rounded-lg border border-border bg-card p-5">
            <WaitlistForm />
          </div>
        </div>
      </div>
    </div>
  );
}

function toJson<T extends { joinedAt: Date; notifiedAt: Date | null; seatedAt: Date | null; leftAt: Date | null }>(item: T) {
  return {
    ...item,
    joinedAt: item.joinedAt.toISOString(),
    notifiedAt: item.notifiedAt?.toISOString() ?? null,
    seatedAt: item.seatedAt?.toISOString() ?? null,
    leftAt: item.leftAt?.toISOString() ?? null,
  };
}
