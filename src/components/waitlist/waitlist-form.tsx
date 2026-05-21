"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createWaitlistSchema, type CreateWaitlistInput } from "@/lib/validators/waitlist";
import { createWaitlistAction } from "@/server/actions/waitlist.actions";
import { cn } from "@/lib/utils";

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 8];

export function WaitlistForm() {
  const router = useRouter();
  const [submitting, start] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateWaitlistInput>({
    resolver: zodResolver(createWaitlistSchema),
    defaultValues: { partySize: 2 },
  });

  const onSubmit = handleSubmit((values) => {
    start(async () => {
      const res = await createWaitlistAction(values);
      if (res.ok) {
        toast.success("Added to waitlist");
        reset({ partySize: 2 });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Name" htmlFor="guestName" error={errors.guestName?.message}>
        <Input id="guestName" placeholder="Guest name" {...register("guestName")} />
      </Field>

      <Field label="Phone" htmlFor="guestPhone" error={errors.guestPhone?.message} hint="Optional">
        <Input id="guestPhone" type="tel" placeholder="+1 (555) 555-0100" {...register("guestPhone")} />
      </Field>

      <Field label="Party size" htmlFor="partySize" error={errors.partySize?.message}>
        <Controller
          name="partySize"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-1.5">
              {PARTY_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => field.onChange(n)}
                  className={cn(
                    "h-9 min-w-[2.25rem] rounded-md border px-2.5 font-mono text-sm tabular-nums transition",
                    field.value === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        />
      </Field>

      <Field label="Quoted wait" htmlFor="quotedWaitMinutes" hint="Optional · minutes" error={errors.quotedWaitMinutes?.message}>
        <Input
          id="quotedWaitMinutes"
          type="number"
          min={0}
          max={240}
          placeholder="30"
          {...register("quotedWaitMinutes", {
            setValueAs: (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
          })}
        />
      </Field>

      <Field label="Notes" htmlFor="notes" hint="Optional" error={errors.notes?.message}>
        <Input id="notes" placeholder="High chair, window seat…" {...register("notes")} />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add to waitlist
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-xs font-medium">
          {label}
        </label>
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
        "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
    />
  );
}
