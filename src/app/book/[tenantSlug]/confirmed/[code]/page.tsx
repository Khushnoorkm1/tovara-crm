import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Calendar, Clock, Users, MapPin, Phone } from "lucide-react";
import { getPublicTenant, getPublicReservationByCode } from "@/server/services/public-booking.service";
import { formatDate, formatPhone, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; code: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getPublicTenant(tenantSlug);
  return {
    title: tenant ? `Reservation confirmed at ${tenant.name}` : "Reservation",
  };
}

export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; code: string }>;
}) {
  const { tenantSlug, code } = await params;
  const [tenant, reservation] = await Promise.all([
    getPublicTenant(tenantSlug),
    getPublicReservationByCode({ tenantSlug, code }),
  ]);
  if (!tenant) notFound();
  if (!reservation) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Not found
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight">
          We couldn't find that reservation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The confirmation code may be wrong, or the reservation has been cancelled.
        </p>
        <Link
          href={`/book/${tenantSlug}`}
          className="mt-6 inline-block text-sm font-medium hover:underline"
          style={{ color: "var(--brand)" }}
        >
          Book a new reservation →
        </Link>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isCancelled = reservation.status === "CANCELLED";

  return (
    <div className="space-y-10">
      {/* Success hero */}
      <header className="text-center">
        {isCancelled ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-destructive">
            Cancelled
          </p>
        ) : (
          <CheckCircle2
            className="mx-auto h-12 w-12"
            style={{ color: "var(--brand)" }}
            strokeWidth={1.5}
          />
        )}
        <h1 className="mt-4 font-display text-4xl tracking-tight">
          {isCancelled
            ? "Reservation cancelled"
            : isPending
            ? "Reservation requested"
            : "You're all set"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isCancelled
            ? "This reservation has been cancelled."
            : isPending
            ? `${tenant.name} will confirm shortly. We've saved your spot.`
            : `We've sent a confirmation to ${reservation.guestEmail}.`}
        </p>
      </header>

      {/* Booking card */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div
          className="border-b border-border px-6 py-3 text-center"
          style={{ backgroundColor: "var(--brand)", color: "white" }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-80">
            Confirmation code
          </p>
          <p className="mt-1 font-mono text-lg tracking-[0.3em]">
            {reservation.confirmationCode.slice(0, 8).toUpperCase()}
          </p>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <Detail icon={<Calendar className="h-3.5 w-3.5" />} label="Date">
            <p className="font-display text-xl tracking-tight">
              {formatDate(reservation.reservationDate, "EEEE")}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(reservation.reservationDate, "MMMM d, yyyy")}
            </p>
          </Detail>

          <Detail icon={<Clock className="h-3.5 w-3.5" />} label="Time">
            <p className="font-display text-xl tracking-tight">
              {formatTime(reservation.startTime, "h:mm a")}
            </p>
          </Detail>

          <Detail icon={<Users className="h-3.5 w-3.5" />} label="Party">
            <p className="font-display text-xl tracking-tight">
              {reservation.partySize}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {reservation.partySize === 1 ? "guest" : "guests"}
              </span>
            </p>
          </Detail>

          <Detail icon={<MapPin className="h-3.5 w-3.5" />} label="Restaurant">
            <p className="text-sm font-medium">{tenant.name}</p>
            {tenant.addressLine1 ? (
              <p className="text-xs text-muted-foreground">
                {tenant.addressLine1}
                {tenant.city ? `, ${tenant.city}` : ""}
                {tenant.state ? `, ${tenant.state}` : ""}
              </p>
            ) : null}
          </Detail>
        </div>

        {(reservation.occasion || reservation.specialRequests) && (
          <div className="border-t border-border px-6 py-5">
            {reservation.occasion ? (
              <p className="text-sm">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Occasion ·{" "}
                </span>
                {reservation.occasion}
              </p>
            ) : null}
            {reservation.specialRequests ? (
              <p className="mt-2 text-sm">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Notes ·{" "}
                </span>
                <span className="italic">{reservation.specialRequests}</span>
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Calendar + contact */}
      {!isCancelled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={googleCalendarUrl({
              title: `Dinner at ${tenant.name}`,
              start: reservation.startTime,
              end: reservation.endTime,
              location: [
                tenant.addressLine1,
                tenant.city,
                tenant.state,
                tenant.postalCode,
              ]
                .filter(Boolean)
                .join(", "),
              details: `Reservation for ${reservation.partySize} · Code ${reservation.confirmationCode.slice(0, 8).toUpperCase()}`,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium transition hover:bg-secondary"
          >
            <Calendar className="h-4 w-4" />
            Add to Google Calendar
          </a>

          {tenant.contactPhone ? (
            <a
              href={`tel:${tenant.contactPhone}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium transition hover:bg-secondary"
            >
              <Phone className="h-4 w-4" />
              Call {formatPhone(tenant.contactPhone)}
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Need to make changes? */}
      <div className="rounded-lg border border-dashed border-border px-6 py-5 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Need to change something?
        </p>
        <p className="mt-2 text-sm">
          Call us
          {tenant.contactPhone ? (
            <>
              {" "}at{" "}
              <a
                href={`tel:${tenant.contactPhone}`}
                className="font-medium hover:underline"
                style={{ color: "var(--brand)" }}
              >
                {formatPhone(tenant.contactPhone)}
              </a>
            </>
          ) : null}{" "}
          or email{" "}
          <a
            href={`mailto:${tenant.contactEmail}`}
            className="font-medium hover:underline"
            style={{ color: "var(--brand)" }}
          >
            {tenant.contactEmail}
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function Detail({
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
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * Build a Google Calendar add-event URL from a reservation.
 */
function googleCalendarUrl(input: {
  title: string;
  start: Date;
  end: Date;
  location: string;
  details: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${fmt(input.start)}/${fmt(input.end)}`,
    details: input.details,
    location: input.location,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}
