import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Calendar, Users, MapPin, Phone, Mail, Cake, Sparkles, AlertCircle } from "lucide-react";
import { ReservationStatus } from "@prisma/client";
import { requireAuthOrRedirect } from "@/server/tenant";
import { getReservationById } from "@/server/services/reservation.service";
import { getOrCreateProgram, getAccountForGuest } from "@/server/services/loyalty.service";
import { getPaymentForReservation } from "@/server/services/payment.service";
import { hasPermission } from "@/server/rbac";
import { formatDate, formatDateTime, formatTime, formatPhone, formatCurrency } from "@/lib/format";
import { StatusPill } from "@/components/reservations/status-pill";
import { ReservationActions } from "@/components/reservations/reservation-actions";
import { SpendRecorder } from "@/components/reservations/spend-recorder";
import { PaymentStatusCard } from "@/components/integrations/payment-status-card";

export const metadata = { title: "Reservation" };
export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "reservation.view")) redirect("/dashboard");

  const { id } = await params;
  const r = await getReservationById(ctx, id);
  if (!r) notFound();

  // Loyalty context for the spend recorder + summary
  const program = await getOrCreateProgram(ctx);
  const account = r.guest?.id ? await getAccountForGuest(ctx, r.guest.id) : null;
  const tierMultiplier = account?.tier?.multiplier ?? 1;
  const showSpendRecorder =
    (r.status === ReservationStatus.SEATED || r.status === ReservationStatus.COMPLETED) &&
    !!r.guestId &&
    hasPermission(ctx.role, "reservation.update");

  // Phase 8: payment row, if any
  const payment = await getPaymentForReservation(ctx, r.id);
  const canRefund = hasPermission(ctx.role, "integration.manage");

  const guestName = r.guest
    ? `${r.guest.firstName} ${r.guest.lastName ?? ""}`.trim()
    : `${r.guestFirstName ?? "Walk-in"} ${r.guestLastName ?? ""}`.trim();
  const isVip = r.guest?.vipStatus === "VIP" || r.guest?.vipStatus === "CELEBRITY";
  const phone = r.guest?.phone ?? r.guestPhone;
  const email = r.guest?.email ?? r.guestEmail;

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <Link
        href="/reservations"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to reservations
      </Link>

      {/* Hero */}
      <div className="mt-6 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Reservation · {r.confirmationCode.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="mt-3 flex items-center gap-3 font-display text-4xl tracking-tight">
            {guestName}
            {isVip ? (
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                VIP
              </span>
            ) : null}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Booked {formatDateTime(r.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StatusPill status={r.status} size="sm" />
          <ReservationActions reservation={r} />
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Main */}
        <div className="space-y-8">
          {/* Service block */}
          <section className="rounded-lg border border-border bg-card p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Service
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <Stat icon={<Calendar className="h-4 w-4" />} label="When">
                <p className="font-display text-2xl tracking-tight">
                  {formatTime(r.startTime, "h:mm a")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(r.reservationDate, "EEE, MMM d")} ·{" "}
                  {durationMinutes(r.startTime, r.endTime)} min
                </p>
              </Stat>

              <Stat icon={<Users className="h-4 w-4" />} label="Party">
                <p className="font-display text-2xl tracking-tight">{r.partySize}</p>
                <p className="text-xs text-muted-foreground">
                  {r.partySize === 1 ? "guest" : "guests"}
                </p>
              </Stat>

              <Stat icon={<MapPin className="h-4 w-4" />} label="Table">
                <p className="text-base">
                  {r.table ? (
                    <>
                      <span className="font-medium">{r.table.name}</span>
                      {r.table.section ? (
                        <span className="text-muted-foreground"> · {r.table.section.name}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not yet assigned</span>
                  )}
                </p>
              </Stat>

              <Stat icon={<Sparkles className="h-4 w-4" />} label="Source">
                <p className="text-base capitalize">
                  {r.source.toLowerCase().replace(/_/g, " ")}
                </p>
              </Stat>
            </div>

            {(r.occasion || r.specialRequests || r.dietaryNotes) && (
              <div className="mt-6 space-y-3 border-t border-border pt-6">
                {r.occasion ? (
                  <Detail icon={<Cake className="h-3.5 w-3.5" />} label="Occasion">
                    {r.occasion}
                  </Detail>
                ) : null}
                {r.specialRequests ? (
                  <Detail icon={<Sparkles className="h-3.5 w-3.5" />} label="Special requests">
                    {r.specialRequests}
                  </Detail>
                ) : null}
                {r.dietaryNotes ? (
                  <Detail icon={<AlertCircle className="h-3.5 w-3.5" />} label="Dietary">
                    {r.dietaryNotes}
                  </Detail>
                ) : null}
              </div>
            )}
          </section>

          {/* Payment (Phase 8) */}
          {payment ? (
            <PaymentStatusCard
              reservationId={r.id}
              payment={{
                id: payment.id,
                amount: payment.amount,
                status: payment.status,
                refundedAmount: payment.refundedAmount,
                authorizedAt: payment.authorizedAt?.toISOString() ?? null,
                refundedAt: payment.refundedAt?.toISOString() ?? null,
                receiptUrl: payment.receiptUrl,
              }}
              canRefund={canRefund}
            />
          ) : null}

          {/* Spend recorder (Phase 5) */}
          {showSpendRecorder ? (
            <SpendRecorder
              reservationId={r.id}
              currentSpend={r.spendAmount}
              pointsPerDollar={program.pointsPerDollar}
              programActive={program.isActive}
              multiplier={tierMultiplier}
            />
          ) : r.spendAmount !== null ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Check total
              </p>
              <p className="mt-2 font-display text-2xl tabular-nums">
                {formatCurrency(r.spendAmount)}
              </p>
              {r.spendRecordedAt ? (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Recorded {formatDateTime(r.spendRecordedAt)}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Status timeline */}
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Timeline
            </p>
            <ul className="mt-4 space-y-2 border-l border-border pl-4">
              <Timeline label="Created" at={r.createdAt} note={r.createdBy?.name ?? r.createdBy?.email} />
              {r.confirmationSentAt ? <Timeline label="Confirmation sent" at={r.confirmationSentAt} /> : null}
              {r.reminderSentAt ? <Timeline label="Reminder sent" at={r.reminderSentAt} /> : null}
              {r.seatedAt ? <Timeline label="Seated" at={r.seatedAt} /> : null}
              {r.completedAt ? <Timeline label="Completed" at={r.completedAt} /> : null}
              {r.noShowAt ? <Timeline label="Marked no-show" at={r.noShowAt} tone="warning" /> : null}
              {r.cancelledAt ? (
                <Timeline label="Cancelled" at={r.cancelledAt} note={r.cancellationReason ?? undefined} tone="destructive" />
              ) : null}
            </ul>
          </section>
        </div>

        {/* Side: guest card */}
        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Guest
            </p>
            <p className="mt-3 text-lg font-medium">{guestName}</p>
            {r.guest && r.guest.totalVisits > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {r.guest.totalVisits} past visits
                {r.guest.lastVisitAt ? ` · last on ${formatDate(r.guest.lastVisitAt, "MMM d, yyyy")}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">First-time guest</p>
            )}

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              {phone ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <a href={`tel:${phone}`} className="hover:text-foreground">
                    {formatPhone(phone)}
                  </a>
                </p>
              ) : null}
              {email ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <a href={`mailto:${email}`} className="hover:text-foreground">
                    {email}
                  </a>
                </p>
              ) : null}
            </div>
          </div>

          {r.guest ? (
            <Link
              href={`/guests/${r.guest.id}`}
              className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition hover:bg-secondary"
            >
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Open profile
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Visit history, notes, tags, lifetime spend.
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition group-hover:text-foreground">
                View →
              </span>
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
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
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm">{children}</p>
      </div>
    </div>
  );
}

function Timeline({
  label,
  at,
  note,
  tone,
}: {
  label: string;
  at: Date;
  note?: string;
  tone?: "warning" | "destructive";
}) {
  const dot =
    tone === "destructive"
      ? "bg-destructive"
      : tone === "warning"
      ? "bg-warning"
      : "bg-primary";
  return (
    <li className="relative">
      <span
        className={`absolute -left-[1.135rem] top-1.5 h-2 w-2 rounded-full ring-2 ring-background ${dot}`}
      />
      <p className="text-sm">{label}</p>
      <p className="text-xs text-muted-foreground">
        {formatDateTime(at)}
        {note ? ` · ${note}` : ""}
      </p>
    </li>
  );
}

function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}
