"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Calendar, Users, Clock, ChevronLeft } from "lucide-react";
import {
  publicBookingSchema,
  type PublicBookingInput,
} from "@/lib/validators/public-booking";
import { submitPublicBookingAction } from "@/server/actions/public-booking.actions";
import { cn } from "@/lib/utils";

type AvailabilitySlot = { time: string; candidateTableIds: string[] };
type Step = "search" | "details";

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export function BookingFlow({
  tenantSlug,
  tenantName,
  address,
  maxPartySize,
  largePartyThreshold,
  advanceBookingDays,
  defaultDate,
}: {
  tenantSlug: string;
  tenantName: string;
  address: string;
  maxPartySize: number;
  largePartyThreshold: number;
  advanceBookingDays: number;
  defaultDate: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("search");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState<string | null>(null);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [closed, setClosed] = useState(false);
  const [closureReason, setClosureReason] = useState<string | undefined>();
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Compute the latest bookable date for the date input's `max` attribute
  const maxDateAttr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + advanceBookingDays);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, [advanceBookingDays]);

  // Reactive availability fetch
  useEffect(() => {
    let cancelled = false;
    if (step !== "search") return;
    if (partySize > maxPartySize) {
      setSlots([]);
      return;
    }
    async function load() {
      setLoadingSlots(true);
      try {
        const url = `/api/public/availability?tenantSlug=${encodeURIComponent(tenantSlug)}&date=${date}&partySize=${partySize}`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        setSlots(data.slots ?? []);
        setClosed(!!data.closed);
        setClosureReason(data.closureReason);
      } catch {
        if (!cancelled) toast.error("Couldn't load availability");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, date, partySize, step, maxPartySize]);

  // -----------------------------------------------------------------
  // Step 1 — search
  // -----------------------------------------------------------------
  if (step === "search") {
    return (
      <div className="space-y-10">
        <Hero tenantName={tenantName} address={address} />

        <Section number="01" label="Party & date">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="How many?">
              <div className="flex flex-wrap gap-1.5">
                {PARTY_OPTIONS.map((n) => (
                  <PartyButton
                    key={n}
                    n={n}
                    active={partySize === n}
                    onClick={() => {
                      setPartySize(n);
                      setStartTime(null);
                    }}
                  />
                ))}
                {maxPartySize > 8 ? (
                  <select
                    value={partySize > 8 ? partySize : ""}
                    onChange={(e) => {
                      setPartySize(Number(e.target.value));
                      setStartTime(null);
                    }}
                    className="h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">More…</option>
                    {Array.from({ length: maxPartySize - 8 }, (_, i) => i + 9).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              {partySize >= largePartyThreshold ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Large parties may receive a follow-up call to confirm.
                </p>
              ) : null}
            </Field>

            <Field label="Date">
              <input
                type="date"
                value={date}
                min={defaultDate}
                max={maxDateAttr}
                onChange={(e) => {
                  setDate(e.target.value);
                  setStartTime(null);
                }}
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
        </Section>

        <Section number="02" label="Available times">
          {loadingSlots ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </div>
          ) : closed ? (
            <ClosedNote reason={closureReason} />
          ) : slots.length === 0 ? (
            <NoAvailability partySize={partySize} maxPartySize={maxPartySize} />
          ) : (
            <SlotGrid
              slots={slots}
              selected={startTime}
              onPick={(t) => setStartTime(t)}
            />
          )}
        </Section>

        <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
          <button
            type="button"
            disabled={!startTime}
            onClick={() => setStep("details")}
            className="inline-flex h-12 items-center gap-2 rounded-md px-6 text-sm font-medium text-white transition disabled:opacity-50"
            style={{ backgroundColor: "var(--brand)" }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // Step 2 — guest details
  // -----------------------------------------------------------------
  return (
    <DetailsStep
      tenantSlug={tenantSlug}
      partySize={partySize}
      date={date}
      startTime={startTime!}
      onBack={() => setStep("search")}
      onSubmitted={(code) => router.push(`/book/${tenantSlug}/confirmed/${code}`)}
    />
  );
}

// ---------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------

function Hero({ tenantName, address }: { tenantName: string; address: string }) {
  return (
    <header className="space-y-3 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Reservations
      </p>
      <h1 className="font-display text-4xl tracking-tight md:text-5xl">
        Book a table at {tenantName}
      </h1>
      {address ? (
        <p className="text-sm text-muted-foreground">{address}</p>
      ) : null}
    </header>
  );
}

// ---------------------------------------------------------------------
// Slot grid
// ---------------------------------------------------------------------

function SlotGrid({
  slots,
  selected,
  onPick,
}: {
  slots: AvailabilitySlot[];
  selected: string | null;
  onPick: (time: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {slots.map((s) => {
        const active = selected === s.time;
        return (
          <button
            key={s.time}
            type="button"
            onClick={() => onPick(s.time)}
            className={cn(
              "h-12 rounded-md border text-sm tabular-nums transition",
              active
                ? "text-white"
                : "border-border bg-card text-foreground hover:bg-secondary",
            )}
            style={
              active
                ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)" }
                : undefined
            }
          >
            {formatHmShort(s.time)}
          </button>
        );
      })}
    </div>
  );
}

function ClosedNote({ reason }: { reason?: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
      <p className="text-sm">
        We're closed on this day{reason ? ` — ${reason}` : ""}.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Try another date above.</p>
    </div>
  );
}

function NoAvailability({
  partySize,
  maxPartySize,
}: {
  partySize: number;
  maxPartySize: number;
}) {
  const tooLarge = partySize > maxPartySize;
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
      <p className="text-sm">
        {tooLarge
          ? `For parties of ${maxPartySize + 1} or more, please call us directly.`
          : `Nothing available for a party of ${partySize} on this day.`}
      </p>
      {!tooLarge ? (
        <p className="mt-1 text-xs text-muted-foreground">Try a different date or party size.</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// Step 2 — details form
// ---------------------------------------------------------------------

function DetailsStep({
  tenantSlug,
  partySize,
  date,
  startTime,
  onBack,
  onSubmitted,
}: {
  tenantSlug: string;
  partySize: number;
  date: string;
  startTime: string;
  onBack: () => void;
  onSubmitted: (confirmationCode: string) => void;
}) {
  const [submitting, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PublicBookingInput>({
    resolver: zodResolver(publicBookingSchema),
    defaultValues: { tenantSlug, partySize, reservationDate: date, startTime },
  });

  const onSubmit = handleSubmit((values) => {
    start(async () => {
      const res = await submitPublicBookingAction(values);
      if (res.ok) {
        // Phase 8: if a deposit checkout URL came back, send the guest to
        // Stripe to pay. Stripe will redirect them to /confirmed/[code] on
        // success or back here on cancel.
        if (res.data.checkoutUrl) {
          toast.success("Redirecting to secure payment…");
          window.location.assign(res.data.checkoutUrl);
          return;
        }
        toast.success("Reservation confirmed!");
        onSubmitted(res.data.confirmationCode);
      } else {
        toast.error(res.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Change time
      </button>

      <BookingSummary partySize={partySize} date={date} startTime={startTime} />

      <Section number="03" label="Your details">
        {/* Hidden fields keep search-step values in the form payload */}
        <input type="hidden" {...register("tenantSlug")} />
        <input type="hidden" {...register("reservationDate")} />
        <input type="hidden" {...register("startTime")} />
        <input type="hidden" {...register("partySize", { valueAsNumber: true })} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.guestFirstName?.message}>
            <Input {...register("guestFirstName")} autoComplete="given-name" />
          </Field>
          <Field label="Last name" error={errors.guestLastName?.message}>
            <Input {...register("guestLastName")} autoComplete="family-name" />
          </Field>
          <Field label="Email" error={errors.guestEmail?.message}>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("guestEmail")}
            />
          </Field>
          <Field label="Phone" error={errors.guestPhone?.message}>
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="+1 (555) 555-0100"
              {...register("guestPhone")}
            />
          </Field>
        </div>
      </Section>

      <Section number="04" label="Anything special?" hint="Optional">
        <div className="grid gap-4">
          <Field label="Occasion">
            <Input
              placeholder="Birthday, anniversary, business…"
              {...register("occasion")}
            />
          </Field>
          <Field label="Special requests">
            <Textarea
              rows={3}
              placeholder="Allergies, accessibility needs, seating preferences…"
              {...register("specialRequests")}
            />
          </Field>
        </div>
      </Section>

      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-12 items-center justify-center px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-sm font-medium text-white transition disabled:opacity-60"
          style={{ backgroundColor: "var(--brand)" }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirm reservation
        </button>
      </div>

      <p className="border-t border-border pt-4 text-center text-[11px] text-muted-foreground">
        By confirming, you agree to receive booking-related messages from this restaurant.
      </p>
    </form>
  );
}

function BookingSummary({
  partySize,
  date,
  startTime,
}: {
  partySize: number;
  date: string;
  startTime: string;
}) {
  const dateObj = parseLocalDate(date);
  return (
    <div
      className="rounded-lg border bg-card p-5"
      style={{ borderColor: "var(--brand)" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Selected
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Stat icon={<Calendar className="h-3.5 w-3.5" />} label="Date">
          {dateObj.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Stat>
        <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Time">
          {formatHmShort(startTime)}
        </Stat>
        <Stat icon={<Users className="h-3.5 w-3.5" />} label="Party">
          {partySize} {partySize === 1 ? "guest" : "guests"}
        </Stat>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------

function Section({
  number,
  label,
  hint,
  children,
}: {
  number: string;
  label: string;
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
          <h2 className="font-display text-xl tracking-tight">{label}</h2>
        </div>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
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

function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
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

function PartyButton({
  n,
  active,
  onClick,
}: {
  n: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 min-w-[2.5rem] rounded-md border px-3 font-mono text-sm tabular-nums transition",
        active
          ? "text-white"
          : "border-border bg-card text-muted-foreground hover:bg-secondary",
      )}
      style={
        active
          ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)" }
          : undefined
      }
    >
      {n}
    </button>
  );
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-1 text-sm font-medium">{children}</p>
    </div>
  );
}

function formatHmShort(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour12 = h! % 12 || 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${pad(m!)} ${period}`;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
