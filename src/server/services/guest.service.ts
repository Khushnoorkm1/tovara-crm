import { Prisma, GuestVipStatus, ReservationStatus } from "@prisma/client";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit, diff } from "@/server/audit";
import type { CreateGuestInput, UpdateGuestInput } from "@/lib/validators/guest";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

const guestListInclude = {
  tags: { include: { tag: true } },
  _count: { select: { notes: true, reservations: true } },
} satisfies Prisma.GuestInclude;

export type GuestListItem = Prisma.GuestGetPayload<{ include: typeof guestListInclude }>;

const guestDetailInclude = {
  tags: { include: { tag: true } },
  notes: {
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  },
  reservations: {
    include: { table: { select: { name: true } } },
    orderBy: { startTime: "desc" },
    take: 50,
  },
} satisfies Prisma.GuestInclude;

export type GuestDetail = Prisma.GuestGetPayload<{ include: typeof guestDetailInclude }>;

// ---------------------------------------------------------------------
// list
// ---------------------------------------------------------------------

export interface ListGuestsParams {
  ctx: AuthedContext;
  search?: string;
  vipStatus?: GuestVipStatus[];
  tagIds?: string[];
  hasNotes?: boolean;
  isReturning?: boolean; // totalVisits > 1
  sortBy?: "name" | "lastVisit" | "totalSpend" | "totalVisits";
  page?: number;
  pageSize?: number;
}

export async function listGuests(params: ListGuestsParams) {
  const {
    ctx,
    search,
    vipStatus,
    tagIds,
    hasNotes,
    isReturning,
    sortBy = "name",
    page = 1,
    pageSize = 50,
  } = params;
  requirePermission(ctx, "guest.view");

  const where: Prisma.GuestWhereInput = {
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {}),
    ...(vipStatus && vipStatus.length ? { vipStatus: { in: vipStatus } } : {}),
    ...(tagIds && tagIds.length ? { tags: { some: { tagId: { in: tagIds } } } } : {}),
    ...(hasNotes ? { notes: { some: {} } } : {}),
    ...(isReturning ? { totalVisits: { gt: 1 } } : {}),
  };

  const orderBy: Prisma.GuestOrderByWithRelationInput =
    sortBy === "lastVisit"
      ? { lastVisitAt: "desc" }
      : sortBy === "totalSpend"
      ? { totalSpend: "desc" }
      : sortBy === "totalVisits"
      ? { totalVisits: "desc" }
      : { lastName: "asc" };

  const [items, total] = await Promise.all([
    ctx.db.guest.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: guestListInclude,
    }),
    ctx.db.guest.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ---------------------------------------------------------------------
// detail
// ---------------------------------------------------------------------

export async function getGuestById(
  ctx: AuthedContext,
  id: string,
): Promise<GuestDetail | null> {
  requirePermission(ctx, "guest.view");
  return ctx.db.guest.findUnique({ where: { id }, include: guestDetailInclude });
}

// ---------------------------------------------------------------------
// create
// ---------------------------------------------------------------------

export async function createGuest(ctx: AuthedContext, input: CreateGuestInput) {
  requirePermission(ctx, "guest.create");

  // Reject obvious dupes — same email or phone within tenant
  if (input.email) {
    const existing = await ctx.db.guest.findFirst({ where: { email: input.email } });
    if (existing) {
      throw new AuthError(409, `A guest with email ${input.email} already exists`);
    }
  }
  if (input.phone) {
    const existing = await ctx.db.guest.findFirst({ where: { phone: input.phone } });
    if (existing) {
      throw new AuthError(409, `A guest with phone ${input.phone} already exists`);
    }
  }

  const guest = await ctx.db.guest.create({
    data: {
      tenantId: ctx.tenantId,
      firstName: input.firstName,
      lastName: input.lastName || null,
      email: input.email || null,
      phone: input.phone || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      addressLine1: input.addressLine1 || null,
      city: input.city || null,
      state: input.state || null,
      postalCode: input.postalCode || null,
      vipStatus: input.vipStatus,
      dietaryRestrictions: input.dietaryRestrictions ?? [],
      allergies: input.allergies ?? [],
      favoriteSeating: input.favoriteSeating || null,
      marketingEmailOptIn: input.marketingEmailOptIn,
      marketingSmsOptIn: input.marketingSmsOptIn,
      marketingOptInAt:
        input.marketingEmailOptIn || input.marketingSmsOptIn ? new Date() : null,
      source: "manual",
    },
  });

  await writeAudit({
    ctx,
    action: "guest.created",
    entityType: "Guest",
    entityId: guest.id,
    changes: { after: { name: `${guest.firstName} ${guest.lastName ?? ""}`, email: guest.email } },
  });

  return guest;
}

// ---------------------------------------------------------------------
// update
// ---------------------------------------------------------------------

export async function updateGuest(
  ctx: AuthedContext,
  id: string,
  input: UpdateGuestInput,
) {
  requirePermission(ctx, "guest.update");

  const existing = await ctx.db.guest.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Guest not found");

  // If email/phone is being changed, ensure no conflict
  if (input.email && input.email !== existing.email) {
    const dupe = await ctx.db.guest.findFirst({
      where: { email: input.email, NOT: { id } },
    });
    if (dupe) throw new AuthError(409, `Email already used by another guest`);
  }
  if (input.phone && input.phone !== existing.phone) {
    const dupe = await ctx.db.guest.findFirst({
      where: { phone: input.phone, NOT: { id } },
    });
    if (dupe) throw new AuthError(409, `Phone already used by another guest`);
  }

  // Track marketing opt-in transitions for audit / compliance
  const optInChanged =
    (input.marketingEmailOptIn !== undefined && input.marketingEmailOptIn !== existing.marketingEmailOptIn) ||
    (input.marketingSmsOptIn !== undefined && input.marketingSmsOptIn !== existing.marketingSmsOptIn);
  const willBeOptedIn =
    (input.marketingEmailOptIn ?? existing.marketingEmailOptIn) ||
    (input.marketingSmsOptIn ?? existing.marketingSmsOptIn);

  const updated = await ctx.db.guest.update({
    where: { id },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName || null } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.dateOfBirth !== undefined
        ? { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }
        : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 || null } : {}),
      ...(input.city !== undefined ? { city: input.city || null } : {}),
      ...(input.state !== undefined ? { state: input.state || null } : {}),
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode || null } : {}),
      ...(input.vipStatus !== undefined ? { vipStatus: input.vipStatus } : {}),
      ...(input.dietaryRestrictions !== undefined
        ? { dietaryRestrictions: input.dietaryRestrictions }
        : {}),
      ...(input.allergies !== undefined ? { allergies: input.allergies } : {}),
      ...(input.favoriteSeating !== undefined
        ? { favoriteSeating: input.favoriteSeating || null }
        : {}),
      ...(input.marketingEmailOptIn !== undefined
        ? { marketingEmailOptIn: input.marketingEmailOptIn }
        : {}),
      ...(input.marketingSmsOptIn !== undefined
        ? { marketingSmsOptIn: input.marketingSmsOptIn }
        : {}),
      ...(optInChanged
        ? willBeOptedIn
          ? { marketingOptInAt: new Date() }
          : { marketingOptOutAt: new Date() }
        : {}),
    },
  });

  await writeAudit({
    ctx,
    action: "guest.updated",
    entityType: "Guest",
    entityId: id,
    changes: diff(
      {
        firstName: existing.firstName,
        lastName: existing.lastName,
        email: existing.email,
        phone: existing.phone,
        vipStatus: existing.vipStatus,
        marketingEmailOptIn: existing.marketingEmailOptIn,
        marketingSmsOptIn: existing.marketingSmsOptIn,
      },
      {
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone,
        vipStatus: updated.vipStatus,
        marketingEmailOptIn: updated.marketingEmailOptIn,
        marketingSmsOptIn: updated.marketingSmsOptIn,
      },
    ),
  });

  return updated;
}

// ---------------------------------------------------------------------
// delete (hard — cascades notes, tag assignments; reservations stay
// orphaned with the denormalized name fields preserved)
// ---------------------------------------------------------------------

export async function deleteGuest(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "guest.delete");
  const existing = await ctx.db.guest.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Guest not found");

  await ctx.db.guest.delete({ where: { id } });

  await writeAudit({
    ctx,
    action: "guest.deleted",
    entityType: "Guest",
    entityId: id,
    changes: { before: { name: `${existing.firstName} ${existing.lastName ?? ""}` } },
  });
}

// ---------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------

/**
 * Stream-friendly export. Returns the full CSV as a string — fine for tens of
 * thousands of guests; for millions, swap to a streamed Response in the route.
 */
export async function exportGuestsCsv(ctx: AuthedContext): Promise<string> {
  requirePermission(ctx, "guest.export");

  const guests = await ctx.db.guest.findMany({
    orderBy: { lastName: "asc" },
    include: { tags: { include: { tag: { select: { name: true } } } } },
  });

  const headers = [
    "First name",
    "Last name",
    "Email",
    "Phone",
    "VIP status",
    "Total visits",
    "Total spend",
    "Average spend",
    "No-shows",
    "First visit",
    "Last visit",
    "Tags",
    "Marketing email opt-in",
    "Marketing SMS opt-in",
    "City",
    "State",
    "Source",
    "Created at",
  ];

  const rows = guests.map((g) => [
    g.firstName,
    g.lastName ?? "",
    g.email ?? "",
    g.phone ?? "",
    g.vipStatus,
    g.totalVisits,
    g.totalSpend.toFixed(2),
    g.averageSpend.toFixed(2),
    g.totalNoShows,
    g.firstVisitAt ? g.firstVisitAt.toISOString().split("T")[0] : "",
    g.lastVisitAt ? g.lastVisitAt.toISOString().split("T")[0] : "",
    g.tags.map((t) => t.tag.name).join(" | "),
    g.marketingEmailOptIn ? "yes" : "no",
    g.marketingSmsOptIn ? "yes" : "no",
    g.city ?? "",
    g.state ?? "",
    g.source ?? "",
    g.createdAt.toISOString(),
  ]);

  const csv = [headers, ...rows].map(toCsvRow).join("\n");

  await writeAudit({
    ctx,
    action: "guest.exported",
    entityType: "Guest",
    entityId: "all",
    changes: { after: { count: guests.length } },
  });

  return csv;
}

function toCsvRow(values: (string | number | undefined)[]): string {
  return values
    .map((v) => {
      const s = v === undefined ? "" : String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}

// ---------------------------------------------------------------------
// Quick count for tag filter UI — how many guests have each tag
// ---------------------------------------------------------------------

export async function getTagCounts(ctx: AuthedContext) {
  requirePermission(ctx, "guest.view");
  const tags = await ctx.db.guestTag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { guests: true } } },
  });
  return tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    isAutoTag: t.isAutoTag,
    count: t._count.guests,
  }));
}

/**
 * Recompute the denormalized metrics on a guest from their reservations.
 * Called after a reservation completes, but also exposed as a helper for
 * fix-it scripts. Audit-free (it's a derived calculation, not user-initiated).
 */
export async function recomputeGuestMetrics(ctx: AuthedContext, guestId: string) {
  const reservations = await ctx.db.reservation.findMany({
    where: { guestId },
    select: { status: true, startTime: true, endTime: true },
  });
  const completed = reservations.filter((r) => r.status === ReservationStatus.COMPLETED);
  const noShows = reservations.filter((r) => r.status === ReservationStatus.NO_SHOW);
  const cancellations = reservations.filter((r) => r.status === ReservationStatus.CANCELLED);
  const visitTimes = completed.map((r) => r.startTime.getTime()).sort((a, b) => a - b);
  await ctx.db.guest.update({
    where: { id: guestId },
    data: {
      totalVisits: completed.length,
      totalNoShows: noShows.length,
      totalCancellations: cancellations.length,
      firstVisitAt: visitTimes[0] ? new Date(visitTimes[0]) : null,
      lastVisitAt: visitTimes.length ? new Date(visitTimes[visitTimes.length - 1]!) : null,
    },
  });
}
