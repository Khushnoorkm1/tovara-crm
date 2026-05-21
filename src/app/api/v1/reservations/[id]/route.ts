import { authenticateApiRequest, okResponse, errResponse } from "@/server/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(req, "reservation:read");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  const r = await ctx.db.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      confirmationCode: true,
      startTime: true,
      endTime: true,
      partySize: true,
      status: true,
      source: true,
      occasion: true,
      specialRequests: true,
      spendAmount: true,
      seatedAt: true,
      completedAt: true,
      cancelledAt: true,
      noShowAt: true,
      createdAt: true,
      guestFirstName: true,
      guestLastName: true,
      guestEmail: true,
      guestPhone: true,
      table: { select: { id: true, name: true } },
      payment: {
        select: { id: true, amount: true, status: true, refundedAmount: true },
      },
    },
  });
  if (!r) return errResponse(404, "not_found", "Reservation not found");

  return okResponse({
    id: r.id,
    confirmationCode: r.confirmationCode,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    partySize: r.partySize,
    status: r.status,
    source: r.source,
    occasion: r.occasion,
    notes: r.specialRequests,
    spendAmount: r.spendAmount,
    timeline: {
      seatedAt: r.seatedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
      noShowAt: r.noShowAt?.toISOString() ?? null,
    },
    table: r.table,
    guest: {
      firstName: r.guestFirstName,
      lastName: r.guestLastName,
      email: r.guestEmail,
      phone: r.guestPhone,
    },
    payment: r.payment,
    createdAt: r.createdAt.toISOString(),
  });
}
