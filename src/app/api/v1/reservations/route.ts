import { NextResponse } from "next/server";
import { authenticateApiRequest, okResponse, errResponse, parsePaging } from "@/server/api-auth";
import { apiCreateReservationSchema } from "@/lib/validators/integrations";
import { ReservationStatus, ReservationSource } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  checkRateLimit,
  keyFromRequest,
  rateLimitedResponse,
  withRateLimitHeaders,
} from "@/server/rate-limit";
import { withRequestLog } from "@/server/observability";

export const dynamic = "force-dynamic";

const READ_LIMIT = { limit: 60, windowMs: 60_000 };
const WRITE_LIMIT = { limit: 20, windowMs: 60_000 };

/**
 * GET /api/v1/reservations
 *
 * Optional query params:
 *   from=2026-05-15        (ISO date)
 *   to=2026-05-22          (ISO date, exclusive)
 *   status=CONFIRMED
 *   page=1&pageSize=20
 */
export const GET = withRequestLog(async (req: Request) => {
  const rl = checkRateLimit(keyFromRequest(req), READ_LIMIT);
  if (!rl.allowed) return rateLimitedResponse(rl);

  const auth = await authenticateApiRequest(req, "reservation:read");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const url = new URL(req.url);
  const { page, pageSize, skip } = parsePaging(req);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) range.lt = new Date(to);
    where.startTime = range;
  }
  if (status) {
    const s = status.toUpperCase();
    if (!(s in ReservationStatus)) {
      return errResponse(400, "invalid_status", `Unknown status: ${status}`);
    }
    where.status = s;
  }

  const [items, total] = await Promise.all([
    ctx.db.reservation.findMany({
      where,
      orderBy: { startTime: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        confirmationCode: true,
        startTime: true,
        endTime: true,
        partySize: true,
        status: true,
        source: true,
        occasion: true,
        spendAmount: true,
        guestFirstName: true,
        guestLastName: true,
        guestEmail: true,
        guestPhone: true,
        createdAt: true,
        table: { select: { id: true, name: true } },
      },
    }),
    ctx.db.reservation.count({ where }),
  ]);

  return okResponse({
    items: items.map((r) => ({
      id: r.id,
      confirmationCode: r.confirmationCode,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
      partySize: r.partySize,
      status: r.status,
      source: r.source,
      occasion: r.occasion,
      spendAmount: r.spendAmount,
      table: r.table,
      guest: {
        firstName: r.guestFirstName,
        lastName: r.guestLastName,
        email: r.guestEmail,
        phone: r.guestPhone,
      },
      createdAt: r.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    hasMore: skip + items.length < total,
  });
});

/**
 * POST /api/v1/reservations — third-party booking integration.
 *
 * Body: { startTime, partySize, guest: { firstName, lastName?, email?, phone? }, occasion?, notes? }
 */
export const POST = withRequestLog(async (req: Request) => {
  const rl = checkRateLimit(keyFromRequest(req), WRITE_LIMIT);
  if (!rl.allowed) return rateLimitedResponse(rl);

  const auth = await authenticateApiRequest(req, "reservation:write");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errResponse(400, "invalid_json", "Body must be valid JSON");
  }
  const parsed = apiCreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return errResponse(400, "invalid_body", parsed.error.errors[0]?.message ?? "Invalid");
  }
  const input = parsed.data;

  const startTime = new Date(input.startTime);
  // Borrow the host-side default duration; we'll keep this simple — public
  // API consumers can specify exact times.
  const settings = await prisma.reservationSettings.findUnique({
    where: { tenantId: ctx.tenantId },
  });
  const durationMin = settings?.defaultDiningDurationMin ?? 90;
  const endTime = new Date(startTime.getTime() + durationMin * 60_000);

  // Find or create a guest record by (email or phone)
  let guestId: string | null = null;
  if (input.guest.email || input.guest.phone) {
    const existing = await ctx.db.guest.findFirst({
      where: {
        OR: [
          input.guest.email ? { email: input.guest.email } : { id: "_" },
          input.guest.phone ? { phone: input.guest.phone } : { id: "_" },
        ],
      },
    });
    if (existing) {
      guestId = existing.id;
    } else {
      const g = await ctx.db.guest.create({
        data: {
          tenantId: ctx.tenantId,
          firstName: input.guest.firstName,
          lastName: input.guest.lastName ?? null,
          email: input.guest.email ?? null,
          phone: input.guest.phone ?? null,
        },
      });
      guestId = g.id;
    }
  }

  const confirmationCode = generateConfirmationCode();
  const reservation = await ctx.db.reservation.create({
    data: {
      tenantId: ctx.tenantId,
      confirmationCode,
      guestId,
      startTime,
      endTime,
      reservationDate: new Date(startTime.toISOString().slice(0, 10)),
      partySize: input.partySize,
      status: ReservationStatus.CONFIRMED,
      source: ReservationSource.THIRD_PARTY,
      guestFirstName: input.guest.firstName,
      guestLastName: input.guest.lastName ?? null,
      guestEmail: input.guest.email ?? null,
      guestPhone: input.guest.phone ?? null,
      occasion: input.occasion ?? null,
      specialRequests: input.notes ?? null,
    },
    select: {
      id: true,
      confirmationCode: true,
      startTime: true,
      partySize: true,
      status: true,
    },
  });

  // Fire reservation.created webhook — fire-and-forget
  (async () => {
    try {
      const { fireWebhookEvent } = await import("@/server/services/webhook.service");
      await fireWebhookEvent({
        tenantId: ctx.tenantId,
        event: "reservation.created",
        payload: {
          reservationId: reservation.id,
          confirmationCode: reservation.confirmationCode,
          startTime: reservation.startTime.toISOString(),
          partySize: reservation.partySize,
          source: "THIRD_PARTY",
        },
      });
    } catch (err) {
      console.error("[api] reservation.created webhook failed:", err);
    }
  })();

  return okResponse(
    {
      id: reservation.id,
      confirmationCode: reservation.confirmationCode,
      startTime: reservation.startTime.toISOString(),
      partySize: reservation.partySize,
      status: reservation.status,
    },
    { status: 201 },
  );
});

function generateConfirmationCode(): string {
  // 12-char URL-friendly cuid-like id; the existing seed uses cuid()
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ).toUpperCase();
}
