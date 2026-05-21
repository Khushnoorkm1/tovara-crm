"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DollarSign, Loader2, Check } from "lucide-react";
import { recordSpendAction } from "@/server/actions/loyalty.actions";
import { cn } from "@/lib/utils";

export function SpendRecorder({
  reservationId,
  currentSpend,
  pointsPerDollar,
  programActive,
  multiplier = 1,
}: {
  reservationId: string;
  currentSpend: number | null;
  pointsPerDollar: number;
  programActive: boolean;
  multiplier?: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(currentSpend ? currentSpend.toFixed(2) : "");
  const [pending, start] = useTransition();
  const numeric = parseFloat(value || "0");
  const validNumber = !Number.isNaN(numeric) && numeric >= 0;
  const previewPoints = validNumber ? Math.round(numeric * pointsPerDollar * multiplier) : 0;
  const dirty = validNumber && (currentSpend == null || Math.abs(numeric - currentSpend) > 0.005);

  function save() {
    if (!validNumber || !dirty) return;
    start(async () => {
      const res = await recordSpendAction({ reservationId, spendAmount: numeric });
      if (res.ok) {
        toast.success(currentSpend == null ? "Check total saved" : "Check total updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Check total
        </p>
        {currentSpend !== null ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-success">
            <Check className="h-3 w-3" />
            Recorded
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={save}
          disabled={!dirty || pending}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
            (!dirty || pending) && "opacity-50",
          )}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </button>
      </div>
      {programActive && previewPoints > 0 ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          ≈ {previewPoints.toLocaleString()} loyalty points
          {multiplier > 1 ? ` (${multiplier}× tier bonus)` : ""}
        </p>
      ) : null}
    </section>
  );
}
