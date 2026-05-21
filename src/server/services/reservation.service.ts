import { Prisma, ReservationStatus, ReservationSource } from "@prisma/client";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit, diff } from "@/server/audit";
import type {
  CreateReservationInput,
  UpdateReservationInput,
  ReservationTransitionInput,
} from "@/lib/validators/reservation";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

const reservationListInclude = {
  guest: { select: { id: true, firstName: true, lastName: true, vipStatus: true, phone: true, email: true } },
  table: { select: { id: true, name: true, sectionId: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationListItem = Prisma.ReservationGetPayload<{ include: typeof reservationListInclude }>;

const reservationDetailInclude = {
  guest: true,
  table: { include: { section: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationDetail = Prisma.ReservationGetPayload<{ include: typeof reservationDetailInclude }>;

// ---------------------------------------------------------------------
// list
// ---------------------------------------------------------------------

export interface ListReservationsParams {
  ctx: AuthedContext;
  date?: string; // YYYY-MM-DD; if provided, scopes to that day
  from?: Date;
  to?: Date;
  status?: ReservationStatus[];
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listReservations(params: ListReservationsParams) {
  const { ctx, date, from, to, status, search, page = 1, pageSize = 100 } = params;
  requirePermission(ctx, "reservation.view");

  const dayStart = date ? new Date(`${date}T00:00:00`) : from;
  const dayEnd = date
    ? new Date(new Date(`${date}T00:00:00`).getTime() + 24 * 60 * 60_000)
    : to;

  const where: Prisma.ReservationWhereInput = {
    ...(dayStart && dayEnd ? { startTime: { gte: dayStart, lt: dayEnd } } : {}),
    ...(status && status.length ? { status: { in: status } } : {}),
    ...(search
      ? {
          OR: [
            { guestFirstName: { contains: search, mode: "insensitive" } },
            { guestLastName: { contains: search, mode: "insensitive" } },
            { guestEmail: { contains: search, mode: "insensitive" } },
            { guestPhone: { contains: search } },
            { confirmationCode: { contains: search, mode: "insensitive" } },
            { guest: { firstName: { contains: search, mode: "insensitive" } } },
            { guest: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    ctx.db.reservation.findMany({
      where,
      orderBy: { startTime: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: reservationListInclude,
    }),
    ctx.db.reservation.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ---------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------

export async function getReservationById(
  ctx: AuthedContext,
  id: string,
): Promise<ReservationDetail | null> {
  requirePermission(ctx, "reservation.view");
  return ctx.db.reservation.findUnique({
    where: { id },
    include: reservationDetailInclude,
  });
}

// ---------------------------------------------------------------------
// create
// ---------------------------------------------------------------------

export async function createReservation(
  ctx: AuthedContext,
  input: CreateReservationInput,
) {
  requirePermission(ctx, "reservation.create");

  // Compose start/end Date in tenant local zone (see availability service note)
  const [y, mo, d] = input.reservationDate.split("-").map(Number);
  const [h, mi] = input.startTime.split(":").map(Number);
  const startTime = new Date(y!, mo! - 1, d!, h!, mi!, 0, 0);

  const settings = await ctx.db.reservationSettings.findFirst({});
  const dineMin = input.durationMinutes ?? settings?.defaultDiningDurationMin ?? 90;
  const endTime = new Date(startTime.getTime() + dineMin * 60_000);

  // Resolve / upsert guest record
  let guestId = input.guestId ?? null;
  if (!guestId && input.guestFirstName) {
    // Reuse by phone or email when we can — prevents duplicate guest records
    const match =
      (input.guestPhone
        ? await ctx.db.guest.findFirst({ where: { phone: input.guestPhone } })
        : null) ??
      (input.guestEmail
        ? await ctx.db.guest.findFirst({ where: { email: input.guestEmail } })
        : null);
    if (match) {
      guestId = match.id;
    } else {
      const created = await ctx.db.guest.create({
        data: {
          tenantId: ctx.tenantId,
          firstName: input.guestFirstName,
          lastName: input.guestLastName || null,
          email: input.guestEmail || null,
          phone: input.guestPhone || null,
          source: "host",
        },
      });
      guestId = created.id;
    }
  }

  // If a tableId was provided, verify it can seat this party and isn't double-booked
  if (input.tableId) {
    const table = await ctx.db.table.findUnique({ where: { id: input.tableId } });
    if (!table) throw new AuthError(403, "Table not found");
    if (table.maxCapacity < input.partySize || table.minCapacity > input.partySize) {
      throw new AuthError(403, `Table ${table.name} can't seat a party of ${input.partySize}`);
    }
    const conflict = await ctx.db.reservation.findFirst({
      where: {
        tableId: input.tableId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (conflict) throw new AuthError(403, "Table is already booked for that time");
  }

  const initialStatus = settings?.autoConfirm
    ? ReservationStatus.CONFIRMED
    : ReservationStatus.PENDING;

  const reservation = await ctx.db.reservation.create({
    data: {
      tenantId: ctx.tenantId,
      guestId,
      tableId: input.tableId ?? null,
      reservationDate: new Date(`${input.reservationDate}T00:00:00`),
      startTime,
      endTime,
      partySize: input.partySize,
      status: initialStatus,
      source: input.source ?? ReservationSource.HOST,
      guestFirstName: input.guestFirstName ?? null,
      guestLastName: input.guestLastName || null,
      guestEmail: input.guestEmail || null,
      guestPhone: input.guestPhone || null,
      occasion: input.occasion || null,
      specialRequests: input.specialRequests || null,
      dietaryNotes: input.dietaryNotes || null,
      createdById: ctx.userId,
    },
    include: reservationDetailInclude,
  });

  await writeAudit({
    ctx,
    action: "reservation.created",
    entityType: "Reservation",
    entityId: reservation.id,
    changes: {
      after: {
        partySize: reservation.partySize,
        startTime: reservation.startTime,
        tableId: reservation.tableId,
        status: reservation.status,
      },
    },
  });

  return reservation;
}

// ---------------------------------------------------------------------
// update
// ---------------------------------------------------------------------

export async function updateReservation(
  ctx: AuthedContext,
  id: string,
  input: UpdateReservationInput,
) {
  requirePermission(ctx, "reservation.update");

  const existing = await ctx.db.reservation.findUnique({ where: { id } });
  if (!existing) throw new AuthError(403, "Reservation not found");

  const settings = await ctx.db.reservationSettings.findFirst({});
  const dineMin = input.durationMinutes ?? settings?.defaultDiningDurationMin ?? 90;

  // Recompute start/end if either changed
  let startTime = existing.startTime;
  let endTime = existing.endTime;
  if (input.reservationDate || input.startTime || input.durationMinutes) {
    const dateStr =
      input.reservationDate ??
      `${existing.reservationDate.getFullYear()}-${pad(existing.reservationDate.getMonth() + 1)}-${pad(existing.reservationDate.getDate())}`;
    const timeStr =
      input.startTime ??
      `${pad(existing.startTime.getHours())}:${pad(existing.startTime.getMinutes())}`;
    const [y, mo, d] = dateStr.split("-").map(Number);
    const [h, mi] = timeStr.split(":").map(Number);
    startTime = new Date(y!, mo! - 1, d!, h!, mi!, 0, 0);
    endTime = new Date(startTime.getTime() + dineMin * 60_000);
  }

  // If table or time changed, re-check overlap
  const newTableId = input.tableId === undefined ? existing.tableId : input.tableId;
  if (newTableId && (input.tableId !== undefined || input.startTime || input.reservationDate)) {
    const conflict = await ctx.db.reservation.findFirst({
      where: {
        id: { not: id },
        tableId: newTableId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (conflict) throw new AuthError(403, "Table is already booked for that time");
  }

  const updated = await ctx.db.reservation.update({
    where: { id },
    data: {
      ...(input.reservationDate ? { reservationDate: new Date(`${input.reservationDate}T00:00:00`) } : {}),
      startTime,
      endTime,
      ...(input.partySize !== undefined ? { partySize: input.partySize } : {}),
      ...(input.tableId !== undefined ? { tableId: input.tableId } : {}),
      ...(input.occasion !== undefined ? { occasion: input.occasion } : {}),
      ...(input.specialRequests !== undefined ? { specialRequests: input.specialRequests } : {}),
      ...(input.dietaryNotes !== undefined ? { dietaryNotes: input.dietaryNotes } : {}),
      ...(input.status ? { status: input.status } : {}),
      updatedById: ctx.userId,
    },
    include: reservationDetailInclude,
  });

  await writeAudit({
    ctx,
    action: "reservation.updated",
    entityType: "Reservation",
    entityId: id,
    changes: diff(
      { startTime: existing.startTime, partySize: existing.partySize, tableId: existing.tableId, status: existing.status },
      { startTime: updated.startTime, partySize: updated.partySize, tableId: updated.tableId, status: updated.status },
    ),
  });

  return updated;
}

// ---------------------------------------------------------------------
// state transitions: seat / complete / no-show / cancel
// ---------------------------------------------------------------------

export async function transitionReservation(
  ctx: AuthedContext,
  id: string,
  input: ReservationTransitionInput,
) {
  const existing = await ctx.db.reservation.findUnique({ where: { id } });
  if (!existing) throw new AuthError(403, "Reservation not found");

  const now = new Date();
  let nextStatus: ReservationStatus;
  const data: Prisma.ReservationUpdateInput = { updatedBy: { connect: { id: ctx.userId } } };

  switch (input.action) {
    case "seat":
      requirePermission(ctx, "reservation.seat");
      if (
        existing.status !== ReservationStatus.CONFIRMED &&
        existing.status !== ReservationStatus.PENDING
      ) {
        throw new AuthError(403, `Cannot seat a ${existing.status.toLowerCase()} reservation`);
      }
      nextStatus = ReservationStatus.SEATED;
      data.seatedAt = now;
      break;

    case "complete":
      requirePermission(ctx, "reservation.seat");
      if (existing.status !== ReservationStatus.SEATED) {
        throw new AuthError(403, `Reservation must be seated before completing`);
      }
      nextStatus = ReservationStatus.COMPLETED;
      data.completedAt = now;
      break;

    case "no_show":
      requirePermission(ctx, "reservation.seat");
      if (
        existing.status !== ReservationStatus.CONFIRMED &&
        existing.status !== ReservationStatus.PENDING
      ) {
        throw new AuthError(403, `Cannot mark a ${existing.status.toLowerCase()} reservation as no-show`);
      }
      nextStatus = ReservationStatus.NO_SHOW;
      data.noShowAt = now;
      break;

    case "cancel":
      requirePermission(ctx, "reservation.cancel");
      if (
        existing.status === ReservationStatus.COMPLETED ||
        existing.status === ReservationStatus.CANCELLED
      ) {
        throw new AuthError(403, `Reservation is already ${existing.status.toLowerCase()}`);
      }
      nextStatus = ReservationStatus.CANCELLED;
      data.cancelledAt = now;
      data.cancellationReason = input.cancellationReason ?? null;
      break;

    default:
      throw new AuthError(403, "Unknown transition");
  }

  data.status = nextStatus;

  const updated = await ctx.db.reservation.update({
    where: { id },
    data,
    include: reservationDetailInclude,
  });

  await writeAudit({
    ctx,
    action: `reservation.${input.action}`,
    entityType: "Reservation",
    entityId: id,
    changes: diff({ status: existing.status }, { status: nextStatus }),
  });

  // Phase 5: award loyalty points when a reservation completes. Failures
  // here are logged but don't roll back the transition — the host has done
  // their job; we'll reconcile loyalty separately if needed.
  if (input.action === "complete") {
    try {
      const { awardForReservationComplete } = await import("./loyalty.service");
      await awardForReservationComplete(ctx, id);
    } catch (err) {
      console.error("[loyalty] award failed:", err);
    }
  }

  // Phase 6: cancellation notice. Fire-and-forget so a provider hiccup
  // doesn't fail the transition.
  if (input.action === "cancel") {
    (async () => {
      try {
        const { sendCancellationNotice } = await import("./messaging/transactional.service");
        await sendCancellationNotice({ tenantId: ctx.tenantId, reservationId: id });
      } catch (err) {
        console.error("[messaging] cancellation send failed:", err);
      }
    })();
  }

  // Phase 8: fire the matching webhook event so partner systems stay in
  // sync. Fire-and-forget — webhook subscribers having a bad day don't
  // affect host workflow.
  (async () => {
    try {
      const { fireWebhookEvent } = await import("./webhook.service");
      const eventMap: Record<typeof input.action, string> = {
        seat: "reservation.seated",
        complete: "reservation.completed",
        cancel: "reservation.cancelled",
        no_show: "reservation.no_show",
      };
      await fireWebhookEvent({
        tenantId: ctx.tenantId,
        event: eventMap[input.action],
        payload: {
          reservationId: id,
          previousStatus: existing.status,
          newStatus: nextStatus,
        },
      });
    } catch (err) {
      console.error("[webhook] reservation event fan-out failed:", err);
    }
  })();

  return updated;
}

// ---------------------------------------------------------------------
// Record spend (post-completion check total)
// ---------------------------------------------------------------------

export async function recordReservationSpend(
  ctx: AuthedContext,
  id: string,
  spendAmount: number,
) {
  requirePermission(ctx, "reservation.update");
  const existing = await ctx.db.reservation.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Reservation not found");

  const previousSpend = existing.spendAmount ?? 0;
  const delta = spendAmount - previousSpend;

  await ctx.db.reservation.update({
    where: { id },
    data: {
      spendAmount,
      spendRecordedAt: new Date(),
    },
  });

  await writeAudit({
    ctx,
    action: "reservation.spend.recorded",
    entityType: "Reservation",
    entityId: id,
    changes: { before: { spendAmount: previousSpend }, after: { spendAmount } },
  });

  // Award (or correct) loyalty points proportionally to the delta. We do this
  // only for already-completed reservations — pre-completion spend changes
  // pile up and the completion handler awards the final total.
  if (
    existing.status === ReservationStatus.COMPLETED &&
    existing.guestId &&
    Math.abs(delta) > 0.005
  ) {
    try {
      const program = await ctx.db.loyaltyProgram.findFirst();
      if (program && program.isActive) {
        const { adjustPoints } = await import("./loyalty.service");
        const deltaPoints = Math.round(delta * program.pointsPerDollar);
        if (deltaPoints !== 0) {
          await adjustPoints(ctx, {
            guestId: existing.guestId,
            points: deltaPoints,
            description: `Spend correction · $${spendAmount.toFixed(2)} total`,
          });
        }
      }
    } catch (err) {
      console.error("[loyalty] spend correction failed:", err);
    }
  }
}

// ---------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
