/**
 * Stripe integration via REST API — no SDK dependency.
 *
 * Each tenant brings its own credentials. We don't use a global Stripe key
 * because deposits are paid into the *restaurant's* account, not ours. In
 * production this would be Stripe Connect with platform-managed accounts;
 * for the demo we accept a raw restricted key per tenant.
 */

const STRIPE_API = "https://api.stripe.com/v1";

export type CreateCheckoutInput = {
  tenantSecretKey: string;
  amount: number; // dollars
  currency?: string;
  description: string;
  customerEmail?: string;
  reservationId: string;
  tenantId: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutResult =
  | { ok: true; sessionId: string; paymentIntentId: string | null; url: string }
  | { ok: false; error: string };

/**
 * Create a Stripe Checkout Session. Returns a URL we redirect the booker to
 * — Stripe hosts the payment form, so we never touch the card data.
 */
export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  if (!input.tenantSecretKey) {
    return { ok: false, error: "Stripe not configured for this tenant" };
  }
  const amountCents = Math.round(input.amount * 100);
  if (amountCents <= 0) return { ok: false, error: "Amount must be positive" };

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("payment_method_types[]", "card");
  body.set("line_items[0][price_data][currency]", input.currency ?? "usd");
  body.set("line_items[0][price_data][unit_amount]", String(amountCents));
  body.set("line_items[0][price_data][product_data][name]", input.description);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("metadata[reservationId]", input.reservationId);
  body.set("metadata[tenantId]", input.tenantId);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);

  try {
    const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.tenantSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[stripe/checkout] failed:", res.status, t.slice(0, 300));
      return { ok: false, error: `Stripe ${res.status}` };
    }
    const data = (await res.json()) as {
      id: string;
      url: string;
      payment_intent: string | null;
    };
    return {
      ok: true,
      sessionId: data.id,
      paymentIntentId: data.payment_intent,
      url: data.url,
    };
  } catch (err) {
    console.error("[stripe/checkout] network error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * Refund a previously authorized payment intent. `amountCents` is optional —
 * omit to refund the full amount. Returns the refund object or an error.
 */
export async function refundPayment(input: {
  tenantSecretKey: string;
  paymentIntentId: string;
  amountCents?: number;
  reason?: "requested_by_customer" | "duplicate" | "fraudulent";
}): Promise<{ ok: true; refundId: string; amountRefunded: number } | { ok: false; error: string }> {
  if (!input.tenantSecretKey) return { ok: false, error: "Stripe not configured" };
  const body = new URLSearchParams();
  body.set("payment_intent", input.paymentIntentId);
  if (input.amountCents != null) body.set("amount", String(input.amountCents));
  if (input.reason) body.set("reason", input.reason);

  try {
    const res = await fetch(`${STRIPE_API}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.tenantSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[stripe/refund] failed:", res.status, t.slice(0, 300));
      return { ok: false, error: `Stripe ${res.status}` };
    }
    const data = (await res.json()) as { id: string; amount: number };
    return { ok: true, refundId: data.id, amountRefunded: data.amount };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * Verify a Stripe webhook signature using HMAC-SHA256. Stripe's signature
 * header is `t=TIMESTAMP,v1=SIGNATURE`. Returns true if any signature in the
 * header matches our computed one within the timestamp tolerance.
 */
export async function verifyStripeWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k!, v!];
    }),
  );
  const timestamp = parts.t;
  if (!timestamp) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > toleranceSeconds) return false;

  // Compute expected signature
  const signed = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(signed));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return parts.v1 === expected;
}
