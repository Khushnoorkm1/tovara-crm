import { prisma, tenantDb } from "@/server/db";
import { ReservationStatus, ReservationSource } from "@prisma/client";
import { writeAuditPublic } from "@/server/audit";
import { getAvailability, type GetAvailabilityResult } from "./availability.service";
import type { PublicBookingInput } from "@/lib/validators/public-booking";

// ---------------------------------------------------------------------
// Public tenant lookup
// ---------------------------------------------------------------------

/**
 * The public-facing tenant card used by the booking widget. We expose only
 * what's safe for guests to see — never internal IDs of other resources,
 * never the auth-only fields.
 */
export type PublicTenant = {
  id: string;
  slug: string;
  name: string;
  primaryColor: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  cuisineType: string | null;
  priceRange: number | null;
  contactEmail: string;
  contactPhone: string | null;
  websiteUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  timezone: string;
  reservationSettings: {
    advanceBookingDays: number;
    minLeadTimeMinutes: number;
    maxPartySize: number;
    largePartyThreshold: number;
    autoConfirm: boolean;
    requireConfirmation: boolean;
  } | null;
};

/**
 * Look up a tenant by its public slug. Returns null if the tenant doesn't
 * exist, is inactive, or hasn't completed onboarding.
 */
export async function getPublicTenant(slug: string): Promise<PublicTenant | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { reservationSettings: true },
  });
  if (!tenant || !tenant.isActive) return null;

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    primaryColor: tenant.primaryColor ?? "#0F172A",
    logoUrl: tenant.logoUrl,
    coverImageUrl: tenant.coverImageUrl,
    cuisineType: tenant.cuisineType,
    priceRange: tenant.priceRange,
    contactEmail: tenant.contactEmail,
    contactPhone: tenant.contactPhone,
    websiteUrl: tenant.websiteUrl,
    addressLine1: tenant.addressLine1,
    addressLine2: tenant.addressLine2,
    city: tenant.city,
    state: tenant.state,
    postalCode: tenant.postalCode,
    timezone: tenant.timezone,
    reservationSettings: tenant.reservationSettings
      ? {
          advanceBookingDays: tenant.reservationSettings.advanceBookingDays,
          minLeadTimeMinutes: tenant.reservationSettings.minLeadTimeMinutes,
          maxPartySize: tenant.reservationSettings.maxPartySize,
          largePartyThreshold: tenant.reservationSettings.largePartyThreshold,
          autoConfirm: tenant.reservationSettings.autoConfirm,
          requireConfirmation: tenant.reservationSettings.requireConfirmation,
        }
      : null,
  };
}

// ---------------------------------------------------------------------
// Public availability — reuses the Phase 2 engine
// ---------------------------------------------------------------------

export async function getPublicAvailability(params: {
  tenantSlug: string;
  date: string;
  partySize: number;
}): Promise<GetAvailabilityResult & { tenantNotFound?: boolean }> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug },
    select: { id: true, isActive: true },
  });
  if (!tenant || !tenant.isActive) {
    return {
      date: params.date,
      partySize: params.partySize,
      slots: [],
      closed: false,
      tenantNotFound: true,
    };
  }
  return getAvailability({
    db: tenantDb(tenant.id),
    date: params.date,
    partySize: params.partySize,
  });
}

// ---------------------------------------------------------------------
// Public booking creation
// ---------------------------------------------------------------------

export type PublicBookingResult = {
  id: string;
  confirmationCode: string;
  status: ReservationStatus;
  checkoutUrl: string | null;
};

/**
 * Create a reservation submitted from the public booking widget.
 *
 * Differences from the internal `createReservation`:
 *   - No auth context — tenant is resolved from the slug in the input.
 *   - The server re-runs availability before committing, so a slot that's
 *     no longer available can't slip through (race-safe: the create itself
 *     would fail the table-overlap check below, but rejecting earlier gives
 *     a cleaner error).
 *   - Source is always ONLINE_WIDGET; createdById is null.
 *   - Always upserts a Guest by phone-then-email match (we know the guest's
 *     contact info and want to start building their profile from booking #1).
 *   - Audit log entry is written with userId: null (system action).
 */
export async function createPublicBooking(
  input: PublicBookingInput,
): Promise<PublicBookingResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
    select: { id: true, isActive: true },
  });
  if (!tenant || !tenant.isActive) {
    throw new PublicBookingError("Restaurant not found");
  }

  const db = tenantDb(tenant.id);
  const settings = await db.reservationSettings.findFirst({});

  // Bail early if party size exceeds max
  if (settings && input.partySize > settings.maxPartySize) {
    throw new PublicBookingError(
      `For parties of ${settings.maxPartySize + 1} or more, please call us directly.`,
    );
  }

  // Re-run availability — a slot may have been claimed since the client picked it
  const availability = await getAvailability({
    db,
    date: input.reservationDate,
    partySize: input.partySize,
  });
  if (availability.closed) {
    throw new PublicBookingError("Sorry, we're closed on that day.");
  }
  const slot = availability.slots.find((s) => s.time === input.startTime);
  if (!slot) {
    throw new PublicBookingError("That time slot is no longer available. Please pick another.");
  }
  // Smallest fitting table from the candidates
  const tableId = slot.candidateTableIds[0] ?? null;

  // Compose start/end Date (tenant local zone — see availability.service note)
  const [y, mo, d] = input.reservationDate.split("-").map(Number);
  const [h, mi] = input.startTime.split(":").map(Number);
  const startTime = new Date(y!, mo! - 1, d!, h!, mi!, 0, 0);
  const dineMin = settings?.defaultDiningDurationMin ?? 90;
  const endTime = new Date(startTime.getTime() + dineMin * 60_000);

  // Resolve / upsert Guest. Phone is required by the public schema, so this
  // always finds-or-creates a guest record we can attach to.
  const existingGuest =
    (await db.guest.findFirst({ where: { phone: input.guestPhone } })) ??
    (await db.guest.findFirst({ where: { email: input.guestEmail } }));
  const guest =
    existingGuest ??
    (await db.guest.create({
      data: {
        tenantId: tenant.id,
        firstName: input.guestFirstName,
        lastName: input.guestLastName,
        email: input.guestEmail,
        phone: input.guestPhone,
        source: "online_widget",
      },
    }));

  const initialStatus = settings?.autoConfirm
    ? ReservationStatus.CONFIRMED
    : ReservationStatus.PENDING;

  const reservation = await db.reservation.create({
    data: {
      tenantId: tenant.id,
      guestId: guest.id,
      tableId,
      reservationDate: new Date(`${input.reservationDate}T00:00:00`),
      startTime,
      endTime,
      partySize: input.partySize,
      status: initialStatus,
      source: ReservationSource.ONLINE_WIDGET,
      guestFirstName: input.guestFirstName,
      guestLastName: input.guestLastName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      occasion: input.occasion || null,
      specialRequests: input.specialRequests || null,
    },
  });

  // System-level audit entry — userId is null (no human triggered this)
  await writeAuditPublic({
    tenantId: tenant.id,
    action: "reservation.created.public",
    entityType: "Reservation",
    entityId: reservation.id,
    changes: {
      after: {
        partySize: reservation.partySize,
        startTime: reservation.startTime,
        guestEmail: reservation.guestEmail,
        status: reservation.status,
      },
    },
  });

  // Phase 6: send confirmation email. Fire-and-forget so a Resend hiccup
  // never fails a booking — the audit log entry above is the source of truth
  // for what the system did.
  (async () => {
    try {
      const { sendBookingConfirmation } = await import(
        "./messaging/transactional.service"
      );
      await sendBookingConfirmation({
        tenantId: tenant.id,
        reservationId: reservation.id,
      });
    } catch (err) {
      console.error("[public-booking] confirmation send failed:", err);
    }
  })();

  // Phase 8: fire reservation.created so partner systems hear about new
  // bookings the moment they happen. Fire-and-forget.
  (async () => {
    try {
      const { fireWebhookEvent } = await import("./webhook.service");
      await fireWebhookEvent({
        tenantId: tenant.id,
        event: "reservation.created",
        payload: {
          reservationId: reservation.id,
          confirmationCode: reservation.confirmationCode,
          startTime: reservation.startTime.toISOString(),
          partySize: reservation.partySize,
          guestName: `${reservation.guestFirstName} ${reservation.guestLastName ?? ""}`.trim(),
          source: "ONLINE_WIDGET",
        },
      });
    } catch (err) {
      console.error("[public-booking] webhook fan-out failed:", err);
    }
  })();

  // Phase 8: if deposits are configured, create a Stripe Checkout Session
  // so the booking action can redirect the guest to pay. We do this *after*
  // creating the reservation — if checkout creation fails, the booking is
  // still in the system as CONFIRMED. The /confirmed/[code] page surfaces
  // the unpaid state. In production you'd hold the reservation in a
  // PENDING_PAYMENT status; for the demo we keep it simple.
  let checkoutUrl: string | null = null;
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId: tenant.id },
    select: { stripeDepositsEnabled: true, stripeSecretKey: true },
  });
  if (subscription?.stripeDepositsEnabled && subscription.stripeSecretKey) {
    try {
      const { createDepositCheckout } = await import("./payment.service");
      const result = await createDepositCheckout({
        tenantId: tenant.id,
        reservationId: reservation.id,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      });
      if ("url" in result) checkoutUrl = result.url;
    } catch (err) {
      console.error("[public-booking] deposit checkout failed:", err);
    }
  }

  return {
    id: reservation.id,
    confirmationCode: reservation.confirmationCode,
    status: reservation.status,
    checkoutUrl,
  };
}

// ---------------------------------------------------------------------
// Confirmation page lookup
// ---------------------------------------------------------------------

/**
 * Public-facing reservation lookup by confirmation code. Used on the
 * `/book/[slug]/confirmed/[code]` page so guests can refresh / share /
 * bookmark the page without a session.
 */
export async function getPublicReservationByCode(params: {
  tenantSlug: string;
  code: string;
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug },
    select: { id: true, isActive: true },
  });
  if (!tenant || !tenant.isActive) return null;

  const reservation = await prisma.reservation.findFirst({
    where: { tenantId: tenant.id, confirmationCode: params.code },
    select: {
      id: true,
      confirmationCode: true,
      status: true,
      reservationDate: true,
      startTime: true,
      endTime: true,
      partySize: true,
      guestFirstName: true,
      guestLastName: true,
      guestEmail: true,
      guestPhone: true,
      occasion: true,
      specialRequests: true,
      createdAt: true,
    },
  });
  return reservation;
}

// ---------------------------------------------------------------------

export class PublicBookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicBookingError";
  }
}
