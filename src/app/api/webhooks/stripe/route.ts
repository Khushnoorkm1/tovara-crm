import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { verifyStripeWebhook } from "@/server/services/integrations/stripe";
import {
  markPaymentAuthorized,
  markPaymentFailed,
} from "@/server/services/payment.service";

export const dynamic = "force-dynamic";

/**
 * Stripe → us webhook receiver. Each tenant has its own webhook secret, so
 * we use the `tenantId` from the event's metadata to look up which secret to
 * verify against.
 *
 * Configure Stripe to POST to:
 *   {APP_URL}/api/webhooks/stripe
 * with events: payment_intent.succeeded, payment_intent.payment_failed,
 * checkout.session.completed.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  // We need to know which tenant's secret to verify against, but the
  // signature is in a header and the tenantId is inside the body. We'll
  // tentatively JSON-parse to read the metadata, then verify before doing
  // anything with side effects.
  let event: {
    type: string;
    data: { object: Record<string, unknown> };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const obj = event.data?.object ?? {};
  const metadata = (obj as { metadata?: Record<string, string> }).metadata ?? {};
  const tenantId = metadata.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "missing_tenant" }, { status: 400 });
  }

  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { stripeWebhookSecret: true },
  });
  if (!subscription?.stripeWebhookSecret) {
    return NextResponse.json({ error: "tenant_not_configured" }, { status: 400 });
  }

  const valid = await verifyStripeWebhook(rawBody, signature, subscription.stripeWebhookSecret);
  if (!valid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // Dispatch
  switch (event.type) {
    case "checkout.session.completed": {
      // The session contains the payment_intent id once payment succeeds
      const session = obj as {
        payment_intent: string | null;
        customer_details?: { email?: string };
      };
      if (session.payment_intent) {
        await markPaymentAuthorized({
          tenantId,
          stripePaymentIntentId: session.payment_intent,
        });
      }
      break;
    }
    case "payment_intent.succeeded": {
      const pi = obj as {
        id: string;
        latest_charge?: string;
        charges?: { data?: Array<{ receipt_url?: string }> };
      };
      await markPaymentAuthorized({
        tenantId,
        stripePaymentIntentId: pi.id,
        chargeId: pi.latest_charge,
        receiptUrl: pi.charges?.data?.[0]?.receipt_url,
      });
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = obj as { id: string; last_payment_error?: { message?: string } };
      await markPaymentFailed({
        tenantId,
        stripePaymentIntentId: pi.id,
        message: pi.last_payment_error?.message,
      });
      break;
    }
    default:
      // Ignore unknown events but acknowledge so Stripe stops retrying
      break;
  }

  return NextResponse.json({ received: true });
}
