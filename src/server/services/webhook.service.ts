import { WebhookDeliveryStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import {
  type CreateWebhookInput,
  type UpdateWebhookInput,
} from "@/lib/validators/integrations";

// ---------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------

export async function listWebhooks(ctx: AuthedContext) {
  requirePermission(ctx, "integration.manage");
  return ctx.db.webhook.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { deliveries: true } },
    },
  });
}

export async function createWebhook(ctx: AuthedContext, input: CreateWebhookInput) {
  requirePermission(ctx, "integration.manage");
  const secret = generateSecret(32);
  const hook = await ctx.db.webhook.create({
    data: {
      tenantId: ctx.tenantId,
      url: input.url,
      events: input.events,
      secret,
      isActive: true,
    },
  });
  await writeAudit({
    ctx,
    action: "webhook.created",
    entityType: "Webhook",
    entityId: hook.id,
    changes: { after: { url: hook.url, events: hook.events } },
  });
  return hook;
}

export async function updateWebhook(
  ctx: AuthedContext,
  id: string,
  input: UpdateWebhookInput,
) {
  requirePermission(ctx, "integration.manage");
  const hook = await ctx.db.webhook.update({ where: { id }, data: input });
  await writeAudit({
    ctx,
    action: "webhook.updated",
    entityType: "Webhook",
    entityId: id,
    changes: { after: input },
  });
  return hook;
}

export async function deleteWebhook(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "integration.manage");
  await ctx.db.webhook.delete({ where: { id } });
  await writeAudit({ ctx, action: "webhook.deleted", entityType: "Webhook", entityId: id });
}

export async function listRecentDeliveries(ctx: AuthedContext, limit = 25) {
  requirePermission(ctx, "integration.manage");
  return ctx.db.webhookDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { webhook: { select: { url: true, id: true } } },
  });
}

// ---------------------------------------------------------------------
// Fire event — fan-out + sign + deliver
// ---------------------------------------------------------------------

export async function fireWebhookEvent(input: {
  tenantId: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const hooks = await prisma.webhook.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      events: { has: input.event },
    },
  });
  if (hooks.length === 0) return;

  const envelope = {
    id: cuid(),
    event: input.event,
    createdAt: new Date().toISOString(),
    data: input.payload,
  };
  const bodyString = JSON.stringify(envelope);

  // Deliver in parallel; never await beyond the function — caller is
  // already fire-and-forget for non-blocking delivery
  await Promise.all(
    hooks.map((hook) =>
      deliverWithRetry({
        webhookId: hook.id,
        url: hook.url,
        secret: hook.secret,
        event: input.event,
        body: bodyString,
        payload: envelope,
      }),
    ),
  );
}

async function deliverWithRetry(input: {
  webhookId: string;
  url: string;
  secret: string;
  event: string;
  body: string;
  payload: Record<string, unknown>;
}) {
  // Persist the delivery row up-front so failure paths still leave a trail
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: input.webhookId,
      event: input.event,
      payload: input.payload as object,
      status: WebhookDeliveryStatus.PENDING,
    },
  });

  const signature = await signHmacSha256(input.body, input.secret);

  let lastError: string | undefined;
  let lastCode: number | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(input.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Tavola-Webhooks/1.0",
          "X-Tavola-Event": input.event,
          "X-Tavola-Signature": signature,
          "X-Tavola-Delivery": delivery.id,
        },
        body: input.body,
        // Short timeout — webhook receivers should ack quickly
        signal: AbortSignal.timeout(8000),
      });
      lastCode = res.status;
      if (res.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: WebhookDeliveryStatus.SUCCESS,
            attemptCount: attempt,
            lastAttemptAt: new Date(),
            responseCode: res.status,
          },
        });
        await prisma.webhook.update({
          where: { id: input.webhookId },
          data: {
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: res.status,
            failureCount: 0,
          },
        });
        return;
      }
      // 4xx: don't retry (the receiver is rejecting us)
      if (res.status >= 400 && res.status < 500) {
        lastError = `${res.status} ${await res.text().catch(() => "")}`.slice(0, 500);
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network error";
    }
    // Exponential backoff between attempts: 500ms, 1500ms
    if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * Math.pow(3, attempt - 1)));
  }

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: WebhookDeliveryStatus.FAILED,
      attemptCount: 3,
      lastAttemptAt: new Date(),
      responseCode: lastCode,
      errorMessage: lastError ?? "Unknown error",
    },
  });
  await prisma.webhook.update({
    where: { id: input.webhookId },
    data: {
      lastDeliveryAt: new Date(),
      lastDeliveryStatus: lastCode ?? 0,
      failureCount: { increment: 1 },
    },
  });
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

async function signHmacSha256(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return (
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function generateSecret(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return (
    "whsec_" +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function cuid(): string {
  // Local cuid-style id for webhook envelopes — not the DB id
  return "evt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
