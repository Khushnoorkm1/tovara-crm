"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  updateLoyaltyProgramSchema,
  type UpdateLoyaltyProgramInput,
} from "@/lib/validators/loyalty";
import { updateLoyaltyProgramAction } from "@/server/actions/loyalty.actions";
import { cn } from "@/lib/utils";

type ProgramState = {
  name: string;
  description: string | null;
  isActive: boolean;
  pointsPerDollar: number;
  pointsPerVisit: number;
  redemptionRate: number;
};

export function ProgramConfigForm({
  program,
  canManage,
}: {
  program: ProgramState;
  canManage: boolean;
}) {
  const router = useRouter();
  const [submitting, start] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UpdateLoyaltyProgramInput>({
    resolver: zodResolver(updateLoyaltyProgramSchema),
    defaultValues: {
      name: program.name,
      description: program.description ?? "",
      isActive: program.isActive,
      pointsPerDollar: program.pointsPerDollar,
      pointsPerVisit: program.pointsPerVisit,
      redemptionRate: program.redemptionRate,
    },
  });

  const isActive = watch("isActive");
  const pointsPerDollar = watch("pointsPerDollar") ?? program.pointsPerDollar;
  const pointsPerVisit = watch("pointsPerVisit") ?? program.pointsPerVisit;
  const redemptionRate = watch("redemptionRate") ?? program.redemptionRate;

  // Example points calc for a $100 spend
  const exampleSpend = 100;
  const examplePoints = Math.round(exampleSpend * pointsPerDollar + pointsPerVisit);
  const exampleDollarValue = examplePoints * redemptionRate;

  const onSubmit = handleSubmit((values) => {
    start(async () => {
      const res = await updateLoyaltyProgramAction(values);
      if (res.ok) {
        toast.success("Program updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  });

  const disabled = !canManage;

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[2fr_1fr]" noValidate>
      <div className="space-y-5">
        <Field label="Program name" error={errors.name?.message}>
          <Input disabled={disabled} {...register("name")} />
        </Field>

        <Field label="Description" hint="Shown on guest profiles" error={errors.description?.message}>
          <Textarea
            rows={2}
            disabled={disabled}
            placeholder="e.g. Earn points on every visit. Unlock perks as you climb."
            {...register("description")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Points per dollar" error={errors.pointsPerDollar?.message}>
            <Input
              type="number"
              step="0.1"
              min={0}
              max={100}
              disabled={disabled}
              {...register("pointsPerDollar", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Bonus per visit" error={errors.pointsPerVisit?.message}>
            <Input
              type="number"
              step="1"
              min={0}
              disabled={disabled}
              {...register("pointsPerVisit", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Redemption rate"
            hint="$ value per point"
            error={errors.redemptionRate?.message}
          >
            <Input
              type="number"
              step="0.001"
              min={0}
              max={1}
              disabled={disabled}
              {...register("redemptionRate", { valueAsNumber: true })}
            />
          </Field>
        </div>

        <label
          className={cn(
            "flex cursor-pointer items-center justify-between rounded-md border px-4 py-3",
            isActive ? "border-success/30 bg-success/5" : "border-border bg-card",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <div>
            <p className="text-sm font-medium">Award points on completed reservations</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When enabled, marking a reservation complete earns the guest points automatically.
            </p>
          </div>
          <input
            type="checkbox"
            disabled={disabled}
            checked={!!isActive}
            onChange={(e) => setValue("isActive", e.target.checked, { shouldDirty: true })}
            className="h-4 w-4 accent-primary"
          />
        </label>

        {canManage ? (
          <div className="border-t border-border pt-5">
            <button
              type="submit"
              disabled={submitting || !isDirty}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save program rules
            </button>
          </div>
        ) : null}
      </div>

      {/* Side: example calculator */}
      <aside className="space-y-3 rounded-lg border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Example
        </p>
        <p className="text-sm">
          A guest spending{" "}
          <span className="font-mono">${exampleSpend.toFixed(0)}</span> on a visit earns:
        </p>
        <p className="font-display text-3xl tracking-tight">
          {examplePoints.toLocaleString()}{" "}
          <span className="text-sm font-normal text-muted-foreground">points</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Redeemable for roughly{" "}
          <span className="font-mono">${exampleDollarValue.toFixed(2)}</span> in rewards.
        </p>
        <hr className="border-border" />
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Tier multipliers apply on top of these numbers.
        </p>
      </aside>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    />
  );
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    />
  );
}
