"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import {
  updateStripeSettingsSchema,
  updateDepositSettingsSchema,
  createApiKeySchema,
  createWebhookSchema,
  updateWebhookSchema,
} from "@/lib/validators/integrations";
import {
  createApiKey as svcCreateKey,
  revokeApiKey as svcRevokeKey,
} from "@/server/services/api-key.service";
import {
  createWebhook as svcCreateHook,
  updateWebhook as svcUpdateHook,
  deleteWebhook as svcDeleteHook,
} from "@/server/services/webhook.service";
import { refundReservationPayment } from "@/server/services/payment.service";
import type { ActionResult } from "./reservation.actions";

// ---- Stripe / deposit settings ----

export async function updateStripeSettingsAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateStripeSettingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
      return { ok: false, error: "Only owners and admins can change Stripe settings" };
    }

    // Stripe deposit fields live on TenantSubscription. Upsert because a
    // tenant might not yet have a subscription row (free plan, fresh signup).
    const data = {
      stripeDepositsEnabled: parsed.data.enabled,
      stripePublishableKey: parsed.data.publishableKey || null,
      // Secret + webhook secret: only update if a non-empty value was provided.
      // Leaves existing values intact when the field is sent blank (which
      // happens whenever we mask the field in the UI).
      ...(parsed.data.secretKey ? { stripeSecretKey: parsed.data.secretKey } : {}),
      ...(parsed.data.webhookSecret
        ? { stripeWebhookSecret: parsed.data.webhookSecret }
        : {}),
    };
    await ctx.db.tenantSubscription.upsert({
      where: { tenantId: ctx.tenantId },
      create: { tenantId: ctx.tenantId, ...data },
      update: data,
    });

    await writeAudit({
      ctx,
      action: "integration.stripe.updated",
      entityType: "TenantSubscription",
      entityId: ctx.tenantId,
      changes: { after: { enabled: parsed.data.enabled } },
    });
    revalidatePath("/settings/integrations");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function updateDepositSettingsAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateDepositSettingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
      return { ok: false, error: "Only owners and admins can change deposit policy" };
    }

    await ctx.db.reservationSettings.update({
      where: { tenantId: ctx.tenantId },
      data: {
        depositPerPerson: parsed.data.depositPerPerson,
        depositRefundPolicy: parsed.data.depositRefundPolicy || null,
      },
    });
    await writeAudit({
      ctx,
      action: "integration.deposit.updated",
      entityType: "ReservationSettings",
      entityId: ctx.tenantId,
      changes: { after: parsed.data },
    });
    revalidatePath("/settings/integrations");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

// ---- API keys ----

export async function createApiKeyAction(
  input: unknown,
): Promise<ActionResult<{ id: string; plaintext: string; prefix: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createApiKeySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    const result = await svcCreateKey(ctx, parsed.data);
    revalidatePath("/settings/integrations");
    return { ok: true, data: result };
  } catch (err) {
    return toError(err);
  }
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    await svcRevokeKey(ctx, id);
    revalidatePath("/settings/integrations");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

// ---- Webhooks ----

export async function createWebhookAction(
  input: unknown,
): Promise<ActionResult<{ id: string; secret: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createWebhookSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    const hook = await svcCreateHook(ctx, parsed.data);
    revalidatePath("/settings/integrations");
    return { ok: true, data: { id: hook.id, secret: hook.secret } };
  } catch (err) {
    return toError(err);
  }
}

export async function updateWebhookAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateWebhookSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    await svcUpdateHook(ctx, id, parsed.data);
    revalidatePath("/settings/integrations");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteWebhookAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    await svcDeleteHook(ctx, id);
    revalidatePath("/settings/integrations");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

// ---- Refund a reservation deposit ----

export async function refundDepositAction(reservationId: string, amount?: number): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    await refundReservationPayment(ctx, reservationId, amount);
    revalidatePath(`/reservations/${reservationId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[integrations action] unexpected:", err);
  return { ok: false, error: "Something went wrong" };
}
