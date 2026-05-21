import { prisma } from "@/server/db";
import { writeAuditPublic } from "@/server/audit";

/**
 * Generate a tamper-proof unsubscribe token for a guest. The token encodes
 * the guestId + tenantId + issue timestamp, signed with an HMAC of the
 * AUTH_SECRET. Stateless — no per-guest token row needed.
 *
 * Format: <guestId>.<tenantId>.<ts>.<sigBase64Url>
 */
export async function buildUnsubscribeToken(guestId: string, tenantId: string): Promise<string> {
  const ts = Date.now().toString(36);
  const payload = `${guestId}.${tenantId}.${ts}`;
  const sig = await hmacSha256(payload, getSecret());
  return `${payload}.${sig}`;
}

/**
 * Verify a token and return the guestId + tenantId if valid. Returns null
 * for tampered or expired (90-day) tokens.
 */
export async function verifyUnsubscribeToken(
  token: string,
): Promise<{ guestId: string; tenantId: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [guestId, tenantId, ts, providedSig] = parts as [string, string, string, string];
  const payload = `${guestId}.${tenantId}.${ts}`;
  const expectedSig = await hmacSha256(payload, getSecret());
  if (expectedSig !== providedSig) return null;

  // 90-day expiry — unsubscribe links shouldn't work forever
  const issued = parseInt(ts, 36);
  if (Number.isNaN(issued)) return null;
  if (Date.now() - issued > 90 * 24 * 60 * 60_000) return null;

  return { guestId, tenantId };
}

/**
 * Mark a guest as opted out of marketing email + bump the campaign's
 * unsubscribedCount if the guest got it from a specific campaign.
 */
export async function processUnsubscribe(input: {
  guestId: string;
  tenantId: string;
  campaignId?: string;
}): Promise<{ alreadyOptedOut: boolean }> {
  const guest = await prisma.guest.findFirst({
    where: { id: input.guestId, tenantId: input.tenantId },
    select: { id: true, marketingEmailOptIn: true, marketingSmsOptIn: true },
  });
  if (!guest) return { alreadyOptedOut: false };
  if (!guest.marketingEmailOptIn && !guest.marketingSmsOptIn) {
    return { alreadyOptedOut: true };
  }

  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      marketingEmailOptIn: false,
      marketingSmsOptIn: false,
      marketingOptOutAt: new Date(),
    },
  });

  if (input.campaignId) {
    await prisma.campaign
      .update({
        where: { id: input.campaignId },
        data: { unsubscribedCount: { increment: 1 } },
      })
      .catch(() => null);
  }

  await writeAuditPublic({
    tenantId: input.tenantId,
    action: "messaging.unsubscribed",
    entityType: "Guest",
    entityId: guest.id,
    changes: { after: { campaignId: input.campaignId } },
  });

  return { alreadyOptedOut: false };
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-only-secret-do-not-use-in-prod";
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
