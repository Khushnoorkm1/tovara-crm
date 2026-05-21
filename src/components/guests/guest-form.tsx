"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GuestVipStatus } from "@prisma/client";
import { createGuestSchema, type CreateGuestInput } from "@/lib/validators/guest";
import { createGuestAction, updateGuestAction } from "@/server/actions/guest.actions";
import { cn } from "@/lib/utils";

const VIP_OPTIONS: { value: GuestVipStatus; label: string }[] = [
  { value: "NONE", label: "No status" },
  { value: "REGULAR", label: "Regular" },
  { value: "VIP", label: "VIP" },
  { value: "CELEBRITY", label: "Celebrity" },
];

const COMMON_DIETARY = ["Vegetarian", "Vegan", "Gluten-free", "Pescatarian", "Kosher", "Halal"];
const COMMON_ALLERGIES = ["Shellfish", "Peanuts", "Tree nuts", "Dairy", "Eggs", "Soy"];

export function GuestForm({
  mode,
  guestId,
  initialValues,
}: {
  mode: "create" | "edit";
  guestId?: string;
  initialValues?: Partial<CreateGuestInput>;
}) {
  const router = useRouter();
  const [submitting, start] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateGuestInput>({
    resolver: zodResolver(createGuestSchema),
    defaultValues: {
      vipStatus: GuestVipStatus.NONE,
      dietaryRestrictions: [],
      allergies: [],
      marketingEmailOptIn: false,
      marketingSmsOptIn: false,
      ...initialValues,
    },
  });

  const onSubmit = handleSubmit((values) => {
    start(async () => {
      const res =
        mode === "create"
          ? await createGuestAction(values)
          : await updateGuestAction(guestId!, values);
      if (res.ok) {
        toast.success(mode === "create" ? "Guest added" : "Profile updated");
        if (mode === "create" && "data" in res) {
          router.push(`/guests/${(res.data as { id: string }).id}`);
        } else {
          router.push(`/guests/${guestId}`);
          router.refresh();
        }
      } else {
        toast.error(res.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      {/* 01 — Identity */}
      <Section number="01" title="Identity">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
            <Input id="firstName" {...register("firstName")} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
            <Input id="lastName" {...register("lastName")} />
          </Field>
          <Field label="Date of birth" htmlFor="dateOfBirth" hint="Optional" error={errors.dateOfBirth?.message}>
            <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
          </Field>
          <Field label="VIP status">
            <Controller
              name="vipStatus"
              control={control}
              render={({ field }) => (
                <div className="flex flex-wrap gap-1.5">
                  {VIP_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => field.onChange(opt.value)}
                      className={cn(
                        "h-9 rounded-md border px-3 text-xs transition",
                        field.value === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>
        </div>
      </Section>

      {/* 02 — Contact */}
      <Section number="02" title="Contact">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" placeholder="+1 (555) 555-0100" {...register("phone")} />
          </Field>
        </div>
      </Section>

      {/* 03 — Address */}
      <Section number="03" title="Address" hint="Optional">
        <div className="grid gap-4">
          <Field label="Street" htmlFor="addressLine1">
            <Input id="addressLine1" {...register("addressLine1")} />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="City" htmlFor="city">
              <Input id="city" {...register("city")} />
            </Field>
            <Field label="State" htmlFor="state">
              <Input id="state" {...register("state")} />
            </Field>
            <Field label="ZIP" htmlFor="postalCode">
              <Input id="postalCode" {...register("postalCode")} />
            </Field>
          </div>
        </div>
      </Section>

      {/* 04 — Preferences */}
      <Section number="04" title="Preferences" hint="Save the host time on the floor">
        <div className="space-y-4">
          <Field label="Allergies">
            <Controller
              name="allergies"
              control={control}
              render={({ field }) => (
                <ChipMultiInput
                  value={field.value ?? []}
                  onChange={field.onChange}
                  suggestions={COMMON_ALLERGIES}
                  placeholder="Type and press Enter…"
                />
              )}
            />
          </Field>

          <Field label="Dietary restrictions">
            <Controller
              name="dietaryRestrictions"
              control={control}
              render={({ field }) => (
                <ChipMultiInput
                  value={field.value ?? []}
                  onChange={field.onChange}
                  suggestions={COMMON_DIETARY}
                  placeholder="Type and press Enter…"
                />
              )}
            />
          </Field>

          <Field label="Favorite seating" htmlFor="favoriteSeating">
            <Input id="favoriteSeating" placeholder="Corner banquette, near window…" {...register("favoriteSeating")} />
          </Field>
        </div>
      </Section>

      {/* 05 — Marketing */}
      <Section number="05" title="Marketing opt-ins" hint="Opt-in dates auto-tracked for compliance">
        <div className="space-y-2.5">
          <Toggle name="marketingEmailOptIn" label="Email marketing" register={register} />
          <Toggle name="marketingSmsOptIn" label="SMS marketing" register={register} />
        </div>
      </Section>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Create guest" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------

function ChipMultiInput({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  function add(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    onChange([...value, trimmed]);
  }
  function remove(label: string) {
    onChange(value.filter((v) => v !== label));
  }
  return (
    <div>
      <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-card p-1.5">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder={value.length === 0 ? placeholder : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              const target = e.currentTarget;
              add(target.value);
              target.value = "";
            }
            if (e.key === "Backspace" && !e.currentTarget.value && value.length > 0) {
              remove(value[value.length - 1]!);
            }
          }}
          className="min-w-[140px] flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {suggestions.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="rounded-full border border-dashed border-border bg-card/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary"
              >
                + {s}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function Toggle({
  name,
  label,
  register,
}: {
  name: keyof CreateGuestInput;
  label: string;
  register: ReturnType<typeof useForm<CreateGuestInput>>["register"];
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-card px-4 py-3 transition hover:bg-secondary">
      <span className="text-sm">{label}</span>
      <input type="checkbox" {...register(name)} className="h-4 w-4 accent-primary" />
    </label>
  );
}

function Section({
  number,
  title,
  hint,
  children,
}: {
  number: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {number}
          </span>
          <h2 className="font-display text-xl tracking-tight">{title}</h2>
        </div>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </header>
      <div>{children}</div>
    </section>
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
        <label htmlFor={htmlFor} className="text-sm font-medium">
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
        "flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
    />
  );
}
