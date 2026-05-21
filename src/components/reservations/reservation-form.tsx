"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Search, X, User, Phone, Mail } from "lucide-react";
import { ReservationSource } from "@prisma/client";
import {
  createReservationSchema,
  type CreateReservationInput,
} from "@/lib/validators/reservation";
import { createReservationAction } from "@/server/actions/reservation.actions";
import { cn } from "@/lib/utils";

type AvailabilitySlot = { time: string; candidateTableIds: string[] };
type GuestSearchResult = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  vipStatus: string;
  totalVisits: number;
};

type TableOption = {
  id: string;
  name: string;
  minCapacity: number;
  maxCapacity: number;
  sectionName: string | null;
};

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];

export function ReservationForm({
  defaultDate,
  tables,
}: {
  defaultDate: string;
  tables: TableOption[];
}) {
  const router = useRouter();
  const [submitting, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateReservationInput>({
    resolver: zodResolver(createReservationSchema),
    defaultValues: {
      reservationDate: defaultDate,
      partySize: 2,
      startTime: "",
      source: ReservationSource.HOST,
    },
  });

  const partySize = watch("partySize");
  const reservationDate = watch("reservationDate");
  const startTime = watch("startTime");
  const tableId = watch("tableId");

  // -----------------------------------------------------------------
  // Availability fetch — runs whenever date or party size changes
  // -----------------------------------------------------------------
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [closed, setClosed] = useState(false);
  const [closureReason, setClosureReason] = useState<string | undefined>();
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!reservationDate || !partySize) return;
      setLoadingSlots(true);
      try {
        const res = await fetch(
          `/api/availability?date=${reservationDate}&partySize=${partySize}`,
        );
        const data = await res.json();
        if (cancelled) return;
        setSlots(data.slots ?? []);
        setClosed(!!data.closed);
        setClosureReason(data.closureReason);
        // Reset any selected start time if it's no longer in the slot list
        if (
          startTime &&
          !(data.slots ?? []).some((s: AvailabilitySlot) => s.time === startTime)
        ) {
          setValue("startTime", "");
          setValue("tableId", undefined);
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationDate, partySize]);

  // -----------------------------------------------------------------
  // Tables that work for the selected slot
  // -----------------------------------------------------------------
  const tablesForSelectedSlot = (() => {
    if (!startTime) return [];
    const slot = slots.find((s) => s.time === startTime);
    if (!slot) return [];
    const set = new Set(slot.candidateTableIds);
    return tables.filter((t) => set.has(t.id));
  })();

  // -----------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------
  const onSubmit = handleSubmit(
    (values) => {
      startTransition(async () => {
        const res = await createReservationAction(values);
        if (res.ok) {
          toast.success("Reservation created");
          router.push(`/reservations/${res.data.id}`);
        } else {
          toast.error(res.error);
        }
      });
    },
    (formErrors) => {
      const first = Object.values(formErrors)[0];
      toast.error(first?.message?.toString() ?? "Please complete the required fields");
    },
  );

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      {/* Section 1: Who & how many */}
      <Section number="01" title="Party & date">
        <div className="grid gap-5 md:grid-cols-2">
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
                        "h-10 min-w-[2.5rem] rounded-md border px-3 font-mono text-sm tabular-nums transition",
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

          <Field label="Date" htmlFor="reservationDate" error={errors.reservationDate?.message}>
            <Input id="reservationDate" type="date" {...register("reservationDate")} />
          </Field>
        </div>
      </Section>

      {/* Section 2: Time slot picker */}
      <Section number="02" title="Available times">
        {loadingSlots ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Looking up availability…
          </div>
        ) : closed ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Closed on this day{closureReason ? ` — ${closureReason}` : ""}.
          </p>
        ) : slots.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            No availability for a party of {partySize} on this day.
          </p>
        ) : (
          <Controller
            name="startTime"
            control={control}
            render={({ field }) => (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => {
                  const display = formatHmShort(s.time);
                  const active = field.value === s.time;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      onClick={() => {
                        field.onChange(s.time);
                        setValue("tableId", undefined);
                      }}
                      className={cn(
                        "h-10 rounded-md border px-3 text-sm tabular-nums transition",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-secondary",
                      )}
                    >
                      {display}
                    </button>
                  );
                })}
              </div>
            )}
          />
        )}
        {errors.startTime ? (
          <p className="text-xs text-destructive">{errors.startTime.message}</p>
        ) : null}
      </Section>

      {/* Section 3: Table (optional) */}
      {startTime && tablesForSelectedSlot.length > 0 ? (
        <Section number="03" title="Table" hint="Optional — we'll pick the best fit if you skip">
          <Controller
            name="tableId"
            control={control}
            render={({ field }) => (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => field.onChange(undefined)}
                  className={cn(
                    "h-10 rounded-md border px-3 text-xs transition",
                    !field.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary",
                  )}
                >
                  Auto
                </button>
                {tablesForSelectedSlot.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => field.onChange(t.id)}
                    className={cn(
                      "h-10 rounded-md border px-3 text-xs transition",
                      field.value === t.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary",
                    )}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({t.minCapacity}-{t.maxCapacity})
                    </span>
                  </button>
                ))}
              </div>
            )}
          />
        </Section>
      ) : null}

      {/* Section 4: Guest */}
      <Section number={startTime ? "04" : "03"} title="Guest">
        <GuestPicker
          onPick={(g) => {
            setValue("guestId", g?.id, { shouldValidate: true });
            setValue("guestFirstName", g?.firstName ?? "", { shouldValidate: true });
            setValue("guestLastName", g?.lastName ?? "");
            setValue("guestEmail", g?.email ?? "");
            setValue("guestPhone", g?.phone ?? "");
          }}
        />
        <input type="hidden" {...register("guestId")} />

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="First name" htmlFor="guestFirstName" error={errors.guestFirstName?.message}>
            <Input id="guestFirstName" {...register("guestFirstName")} />
          </Field>
          <Field label="Last name" htmlFor="guestLastName" error={errors.guestLastName?.message}>
            <Input id="guestLastName" {...register("guestLastName")} />
          </Field>
          <Field label="Phone" htmlFor="guestPhone" error={errors.guestPhone?.message}>
            <Input id="guestPhone" type="tel" placeholder="+1 (555) 555-0100" {...register("guestPhone")} />
          </Field>
          <Field label="Email" htmlFor="guestEmail" error={errors.guestEmail?.message}>
            <Input id="guestEmail" type="email" {...register("guestEmail")} />
          </Field>
        </div>
      </Section>

      {/* Section 5: Notes */}
      <Section number={startTime ? "05" : "04"} title="Notes" hint="Optional">
        <div className="grid gap-4">
          <Field label="Occasion" htmlFor="occasion">
            <Input id="occasion" placeholder="Birthday, anniversary…" {...register("occasion")} />
          </Field>
          <Field label="Special requests" htmlFor="specialRequests">
            <Textarea id="specialRequests" rows={2} {...register("specialRequests")} />
          </Field>
          <Field label="Dietary notes" htmlFor="dietaryNotes">
            <Textarea id="dietaryNotes" rows={2} placeholder="Allergies, restrictions…" {...register("dietaryNotes")} />
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={submitting || !startTime}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirm reservation
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-11 items-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        {!startTime ? (
          <span className="ml-auto text-xs text-muted-foreground">
            Pick a time slot above to enable
          </span>
        ) : tableId ? (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Table assigned
          </span>
        ) : null}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Guest picker — debounced /api/guests/search lookup
// ---------------------------------------------------------------------

function GuestPicker({ onPick }: { onPick: (g: GuestSearchResult | null) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GuestSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<GuestSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.trim().length < 2 || picked) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/guests/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.items ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, picked]);

  if (picked) {
    return (
      <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {picked.firstName} {picked.lastName ?? ""}
              {picked.vipStatus === "VIP" || picked.vipStatus === "CELEBRITY" ? (
                <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
                  VIP
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {picked.totalVisits > 0 ? `${picked.totalVisits} past visits` : "First-time guest"}
              {picked.phone ? ` · ${picked.phone}` : ""}
              {picked.email ? ` · ${picked.email}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setPicked(null);
            setQ("");
            onPick(null);
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Clear guest"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-2 rounded-md border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search returning guests by name, phone, or email…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      {open && results.length > 0 ? (
        <ul className="absolute left-0 right-0 top-12 z-10 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {results.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => {
                  setPicked(g);
                  setOpen(false);
                  onPick(g);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-secondary"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {g.firstName} {g.lastName ?? ""}
                  </p>
                  <p className="flex items-center gap-2 truncate text-[11px] text-muted-foreground">
                    {g.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {g.phone}
                      </span>
                    ) : null}
                    {g.email ? (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {g.email}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {g.totalVisits} visits
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        Or just enter their info below to create a new guest record.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Local primitives (kept inline so the project boots before shadcn install)
// ---------------------------------------------------------------------

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
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
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

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
    />
  );
}

function formatHmShort(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const period = h! >= 12 ? "p" : "a";
  const hour12 = h! % 12 || 12;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${pad2(m!)}${period}`;
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
