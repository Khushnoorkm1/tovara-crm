"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Loader2 } from "lucide-react";
import { DayOfWeek } from "@prisma/client";
import { saveOperatingHoursAction } from "@/server/actions/settings.actions";
import { cn } from "@/lib/utils";

type Shift = {
  id?: string;
  dayOfWeek: DayOfWeek;
  openTime: string;
  closeTime: string;
  shiftName: string | null;
  isClosed: boolean;
};

const DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export function OperatingHoursEditor({
  shifts: initial,
  canEdit,
}: {
  shifts: Shift[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shifts, setShifts] = useState<Shift[]>(initial);

  function shiftsForDay(day: DayOfWeek): Shift[] {
    return shifts.filter((s) => s.dayOfWeek === day);
  }

  function addShift(day: DayOfWeek) {
    const existing = shiftsForDay(day);
    const defaultOpen = existing.length > 0 ? "17:00" : "11:00";
    const defaultClose = existing.length > 0 ? "22:00" : "14:30";
    setShifts((prev) => [
      ...prev,
      {
        dayOfWeek: day,
        openTime: defaultOpen,
        closeTime: defaultClose,
        shiftName: existing.length > 0 ? "Dinner" : "Lunch",
        isClosed: false,
      },
    ]);
  }

  function updateShift(index: number, patch: Partial<Shift>) {
    setShifts((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeShift(index: number) {
    setShifts((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    start(async () => {
      const res = await saveOperatingHoursAction({
        shifts: shifts.map(({ id, ...rest }) => rest),
      });
      if (res.ok) {
        toast.success("Operating hours saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {DAYS.map((day) => {
        const dayShifts = shiftsForDay(day);
        const indices = shifts
          .map((s, i) => (s.dayOfWeek === day ? i : -1))
          .filter((i) => i >= 0);

        return (
          <div key={day} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{DAY_LABELS[day]}</p>
              {canEdit ? (
                <button
                  onClick={() => addShift(day)}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-border px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  Add shift
                </button>
              ) : null}
            </div>

            {dayShifts.length === 0 ? (
              <p className="mt-3 text-xs italic text-muted-foreground">Closed</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dayShifts.map((s, idx) => {
                  const i = indices[idx]!;
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-md border border-border bg-background p-2"
                    >
                      <input
                        value={s.shiftName ?? ""}
                        onChange={(e) => updateShift(i, { shiftName: e.target.value })}
                        disabled={!canEdit}
                        placeholder="Shift"
                        className="h-8 w-24 rounded border border-input bg-card px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="time"
                        value={s.openTime}
                        onChange={(e) => updateShift(i, { openTime: e.target.value })}
                        disabled={!canEdit}
                        className="h-8 rounded border border-input bg-card px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">→</span>
                      <input
                        type="time"
                        value={s.closeTime}
                        onChange={(e) => updateShift(i, { closeTime: e.target.value })}
                        disabled={!canEdit}
                        className="h-8 rounded border border-input bg-card px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <span className="flex-1" />
                      {canEdit ? (
                        <button
                          onClick={() => removeShift(i)}
                          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      {canEdit ? (
        <div className="pt-2">
          <button
            onClick={save}
            disabled={pending}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
              pending && "opacity-50",
            )}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save operating hours
          </button>
        </div>
      ) : null}
    </div>
  );
}
