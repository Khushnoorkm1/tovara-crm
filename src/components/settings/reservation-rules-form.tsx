"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveReservationRulesAction } from "@/server/actions/settings.actions";
import { cn } from "@/lib/utils";

type Settings = {
  advanceBookingDays: number;
  minLeadTimeMinutes: number;
  slotDurationMinutes: number;
  defaultDiningDurationMin: number;
  maxPartySize: number;
  largePartyThreshold: number;
  autoConfirm: boolean;
  allowWaitlist: boolean;
  sendConfirmationEmail: boolean;
  sendReminderEmail: boolean;
  reminderHoursBefore: number;
};

export function ReservationRulesForm({
  settings: initial,
  canEdit,
}: {
  settings: Settings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveReservationRulesAction(s);
      if (res.ok) {
        toast.success("Rules saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Timing */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Timing
        </p>
        <div className="mt-4 space-y-4">
          <NumField
            label="Advance booking window"
            unit="days"
            value={s.advanceBookingDays}
            onChange={(v) => set("advanceBookingDays", v)}
            disabled={!canEdit}
          />
          <NumField
            label="Minimum lead time"
            unit="minutes"
            value={s.minLeadTimeMinutes}
            onChange={(v) => set("minLeadTimeMinutes", v)}
            disabled={!canEdit}
          />
          <NumField
            label="Slot duration"
            unit="minutes"
            value={s.slotDurationMinutes}
            onChange={(v) => set("slotDurationMinutes", v)}
            disabled={!canEdit}
            hint="How granular the time picker is — 15 or 30 typically."
          />
          <NumField
            label="Default dining duration"
            unit="minutes"
            value={s.defaultDiningDurationMin}
            onChange={(v) => set("defaultDiningDurationMin", v)}
            disabled={!canEdit}
            hint="How long a table is blocked per booking."
          />
        </div>
      </div>

      {/* Party */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Party size
        </p>
        <div className="mt-4 space-y-4">
          <NumField
            label="Maximum party size"
            value={s.maxPartySize}
            onChange={(v) => set("maxPartySize", v)}
            disabled={!canEdit}
          />
          <NumField
            label="Large-party threshold"
            value={s.largePartyThreshold}
            onChange={(v) => set("largePartyThreshold", v)}
            disabled={!canEdit}
            hint="Parties at or above this require approval (Phase 9.5)."
          />
        </div>
      </div>

      {/* Policy */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Policy
        </p>
        <div className="mt-4 space-y-3">
          <Toggle
            label="Auto-confirm reservations"
            hint="When off, bookings land in a pending state for host review."
            value={s.autoConfirm}
            onChange={(v) => set("autoConfirm", v)}
            disabled={!canEdit}
          />
          <Toggle
            label="Allow waitlist"
            value={s.allowWaitlist}
            onChange={(v) => set("allowWaitlist", v)}
            disabled={!canEdit}
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Notifications
        </p>
        <div className="mt-4 space-y-3">
          <Toggle
            label="Send confirmation email"
            value={s.sendConfirmationEmail}
            onChange={(v) => set("sendConfirmationEmail", v)}
            disabled={!canEdit}
          />
          <Toggle
            label="Send reminder email"
            value={s.sendReminderEmail}
            onChange={(v) => set("sendReminderEmail", v)}
            disabled={!canEdit}
          />
          <NumField
            label="Reminder hours before"
            unit="hours"
            value={s.reminderHoursBefore}
            onChange={(v) => set("reminderHoursBefore", v)}
            disabled={!canEdit || !s.sendReminderEmail}
          />
        </div>
      </div>

      {canEdit ? (
        <div className="lg:col-span-2">
          <button
            onClick={save}
            disabled={pending}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
              pending && "opacity-50",
            )}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save reservation rules
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm">{label}</label>
        {unit ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-md border border-border bg-background px-3 py-2",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm">{label}</p>
        {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
      </div>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 accent-primary"
      />
    </label>
  );
}
