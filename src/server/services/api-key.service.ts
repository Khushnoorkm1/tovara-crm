import { prisma } from "@/server/db";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import {
  type CreateApiKeyInput,
  API_SCOPES,
  type ApiScope,
} from "@/lib/validators/integrations";

export async function listApiKeys(ctx: AuthedContext) {
  requirePermission(ctx, "integration.manage");
  return ctx.db.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

/**
 * Generate a new API key. Returns the plaintext key ONCE — we hash on store
 * and never store the plaintext. Caller is responsible for showing it to the
 * user and warning them they won't see it again.
 */
export async function createApiKey(ctx: AuthedContext, input: CreateApiKeyInput) {
  requirePermission(ctx, "integration.manage");

  const plaintext = generatePlaintextKey();
  const prefix = plaintext.slice(0, 12); // "rk_live_abcd"
  const keyHash = await sha256Hex(plaintext);

  const apiKey = await ctx.db.apiKey.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      keyHash,
      prefix,
      scopes: input.scopes,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });

  await writeAudit({
    ctx,
    action: "apikey.created",
    entityType: "ApiKey",
    entityId: apiKey.id,
    changes: { after: { name: apiKey.name, scopes: apiKey.scopes, prefix } },
  });

  return { id: apiKey.id, plaintext, prefix };
}

export async function revokeApiKey(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "integration.manage");
  await ctx.db.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  await writeAudit({
    ctx,
    action: "apikey.revoked",
    entityType: "ApiKey",
    entityId: id,
  });
}

// ---------------------------------------------------------------------
// Verification — called by the public API routes
// ---------------------------------------------------------------------

export type VerifiedKey = {
  tenantId: string;
  keyId: string;
  scopes: ApiScope[];
};

/**
 * Verify a presented API key. Returns the tenant + scope info or null. Side
 * effect: updates lastUsedAt on a successful match (fire-and-forget).
 */
export async function verifyApiKey(plaintext: string | null): Promise<VerifiedKey | null> {
  if (!plaintext || !plaintext.startsWith("rk_")) return null;
  const keyHash = await sha256Hex(plaintext);
  const key = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      tenantId: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
    },
  });
  if (!key) return null;
  if (key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Touch lastUsedAt — don't await
  prisma.apiKey
    .update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => null);

  return {
    tenantId: key.tenantId,
    keyId: key.id,
    scopes: key.scopes.filter((s): s is ApiScope =>
      (API_SCOPES as readonly string[]).includes(s),
    ),
  };
}

export function requireScope(key: VerifiedKey, scope: ApiScope): void {
  if (!key.scopes.includes(scope)) {
    throw new AuthError(403, `API key is missing the "${scope}" scope`);
  }
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function generatePlaintextKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const body = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `rk_live_${body}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
