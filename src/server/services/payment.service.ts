import { PaymentStatus } from "@prisma/client";
import { prisma, tenantDb } from "@/server/db";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit, writeAuditPublic } from "@/server/audit";
import { createCheckoutSession, refundPayment } from "./integrations/stripe";

/**
 * Compute the deposit amount required for a reservation. Returns 0 if
 * deposits aren't configured.
 */
export async function computeDepositAmount(input: {
  tenantId: string;
  partySize: number;
}): Promise<number> {
  const settings = await prisma.reservationSettings.findUnique({
    where: { tenantId: input.tenantId },
  });
  const perPerson = settings?.depositPerPerson ?? 0;
  if (!perPerson || perPerson <= 0) return 0;
  return Math.round(perPerson * input.partySize * 100) / 100;
}

/**
 * Create a Stripe Checkout Session for a reservation's deposit and persist
 * a Payment record in PENDING. Returns the hosted Checkout URL.
 */
export async function createDepositCheckout(input: {
  tenantId: string;
  reservationId: string;
  appUrl: string; // e.g. "http://localhost:3000"
}): Promise<{ url: string; payment: { id: string; amount: number } } | { error: string }> {
  const [tenant, subscription] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: input.tenantId } }),
    prisma.tenantSubscription.findUnique({ where: { tenantId: input.tenantId } }),
  ]);
  if (!tenant) return { error: "Tenant not found" };
  if (!subscription?.stripeDepositsEnabled || !subscription.stripeSecretKey) {
    return { error: "Stripe deposits not configured" };
  }
  const reservation = await prisma.reservation.findFirst({
    where: { id: input.reservationId, tenantId: input.tenantId },
    include: { guest: true },
  });
  if (!reservation) return { error: "Reservation not found" };

  const amount = await computeDepositAmount({
    tenantId: input.tenantId,
    partySize: reservation.partySize,
  });
  if (amount <= 0) return { error: "No deposit required" };

  const recipientEmail = reservation.guest?.email ?? reservation.guestEmail ?? undefined;

  const session = await createCheckoutSession({
    tenantSecretKey: subscription.stripeSecretKey,
    amount,
    description: `${tenant.name} · Reservation deposit · ${reservation.partySize} guests`,
    customerEmail: recipientEmail,
    reservationId: reservation.id,
    tenantId: tenant.id,
    successUrl: `${input.appUrl}/book/${tenant.slug}/confirmed/${reservation.confirmationCode}?paid=1`,
    cancelUrl: `${input.appUrl}/book/${tenant.slug}/confirmed/${reservation.confirmationCode}?cancelled=1`,
  });
  if (!session.ok) return { error: session.error };

  // Upsert because the booker may have abandoned a previous attempt
  const payment = await prisma.payment.upsert({
    where: { reservationId: reservation.id },
    create: {
      tenantId: tenant.id,
      reservationId: reservation.id,
      amount,
      status: PaymentStatus.PENDING,
      stripeCheckoutSessionId: session.sessionId,
      stripePaymentIntentId: session.paymentIntentId,
      checkoutUrl: session.url,
    },
    update: {
      amount,
      status: PaymentStatus.PENDING,
      stripeCheckoutSessionId: session.sessionId,
      stripePaymentIntentId: session.paymentIntentId,
      checkoutUrl: session.url,
    },
  });

  await writeAuditPublic({
    tenantId: tenant.id,
    action: "payment.checkout.created",
    entityType: "Payment",
    entityId: payment.id,
    changes: { after: { amount, reservationId: reservation.id } },
  });

  return { url: session.url, payment: { id: payment.id, amount } };
}

/**
 * Mark a payment as authorized — called from the Stripe webhook handler
 * when `payment_intent.succeeded` arrives.
 */
export async function markPaymentAuthorized(input: {
  tenantId: string;
  stripePaymentIntentId: string;
  chargeId?: string;
  receiptUrl?: string;
}): Promise<{ paymentId: string; reservationId: string } | null> {
  const payment = await prisma.payment.findFirst({
    where: {
      tenantId: input.tenantId,
      stripePaymentIntentId: input.stripePaymentIntentId,
    },
  });
  if (!payment) return null;
  if (payment.status === PaymentStatus.AUTHORIZED) {
    return { paymentId: payment.id, reservationId: payment.reservationId };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.AUTHORIZED,
      authorizedAt: new Date(),
      stripeChargeId: input.chargeId,
      receiptUrl: input.receiptUrl,
    },
  });

  await writeAuditPublic({
    tenantId: input.tenantId,
    action: "payment.authorized",
    entityType: "Payment",
    entityId: payment.id,
    changes: { after: { amount: payment.amount } },
  });

  // Fire webhook to subscribers (Phase 8 webhook ledger)
  try {
    const { fireWebhookEvent } = await import("./webhook.service");
    await fireWebhookEvent({
      tenantId: input.tenantId,
      event: "payment.authorized",
      payload: {
        paymentId: payment.id,
        reservationId: payment.reservationId,
        amount: payment.amount,
      },
    });
  } catch (err) {
    console.error("[payment] webhook fan-out failed:", err);
  }

  return { paymentId: payment.id, reservationId: payment.reservationId };
}

export async function markPaymentFailed(input: {
  tenantId: string;
  stripePaymentIntentId: string;
  message?: string;
}) {
  const payment = await prisma.payment.findFirst({
    where: {
      tenantId: input.tenantId,
      stripePaymentIntentId: input.stripePaymentIntentId,
    },
  });
  if (!payment) return;
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.FAILED,
      failedAt: new Date(),
      failureMessage: input.message ?? null,
    },
  });
}

/**
 * Refund a payment. Manager-grade action. Issues the refund through Stripe
 * and updates the local Payment row.
 */
export async function refundReservationPayment(
  ctx: AuthedContext,
  reservationId: string,
  amountToRefund?: number,
) {
  requirePermission(ctx, "integration.manage");
  const subscription = await ctx.db.tenantSubscription.findUnique({
    where: { tenantId: ctx.tenantId },
  });
  if (!subscription?.stripeSecretKey) {
    throw new AuthError(403, "Stripe is not configured");
  }
  const payment = await ctx.db.payment.findUnique({
    where: { reservationId },
  });
  if (!payment) throw new AuthError(404, "No payment on this reservation");
  if (!payment.stripePaymentIntentId) {
    throw new AuthError(403, "Payment never reached Stripe");
  }
  if (payment.status !== PaymentStatus.AUTHORIZED) {
    throw new AuthError(403, `Can't refund a ${payment.status.toLowerCase()} payment`);
  }

  const cents =
    amountToRefund !== undefined ? Math.round(amountToRefund * 100) : undefined;

  const result = await refundPayment({
    tenantSecretKey: subscription.stripeSecretKey,
    paymentIntentId: payment.stripePaymentIntentId,
    amountCents: cents,
    reason: "requested_by_customer",
  });
  if (!result.ok) throw new AuthError(502, result.error);

  const refunded = result.amountRefunded / 100;
  const totalRefunded = (payment.refundedAmount ?? 0) + refunded;
  const newStatus =
    totalRefunded >= payment.amount - 0.005
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIAL_REFUND;

  await ctx.db.payment.update({
    where: { id: payment.id },
    data: {
      status: newStatus,
      refundedAt: newStatus === PaymentStatus.REFUNDED ? new Date() : payment.refundedAt,
      refundedAmount: totalRefunded,
    },
  });

  await writeAudit({
    ctx,
    action: "payment.refunded",
    entityType: "Payment",
    entityId: payment.id,
    changes: { after: { refunded, total: totalRefunded } },
  });

  // Fire webhook
  try {
    const { fireWebhookEvent } = await import("./webhook.service");
    await fireWebhookEvent({
      tenantId: ctx.tenantId,
      event: "payment.refunded",
      payload: { paymentId: payment.id, reservationId, amountRefunded: refunded },
    });
  } catch (err) {
    console.error("[payment] webhook fan-out failed:", err);
  }
}

/**
 * Find the payment for a reservation — used by the reservation detail page.
 */
export async function getPaymentForReservation(ctx: AuthedContext, reservationId: string) {
  return ctx.db.payment.findUnique({ where: { reservationId } });
}
