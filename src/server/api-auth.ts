import { NextResponse } from "next/server";
import { tenantDb } from "@/server/db";
import { verifyApiKey, type VerifiedKey } from "@/server/services/api-key.service";
import type { ApiScope } from "@/lib/validators/integrations";

export type ApiContext = {
  tenantId: string;
  keyId: string;
  scopes: ApiScope[];
  db: ReturnType<typeof tenantDb>;
};

/**
 * Authenticate a public API request. Pass the required scope; returns the
 * context or a Response that callers should return directly.
 */
export async function authenticateApiRequest(
  req: Request,
  requiredScope: ApiScope,
): Promise<{ ctx: ApiContext } | { error: NextResponse }> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { error: errResponse(401, "missing_credentials", "Authorization header required") };
  }
  const verified = await verifyApiKey(m[1]!);
  if (!verified) {
    return { error: errResponse(401, "invalid_credentials", "Invalid or revoked API key") };
  }
  if (!verified.scopes.includes(requiredScope)) {
    return {
      error: errResponse(403, "insufficient_scope", `Missing scope: ${requiredScope}`),
    };
  }
  const ctx: ApiContext = {
    tenantId: verified.tenantId,
    keyId: verified.keyId,
    scopes: verified.scopes,
    db: tenantDb(verified.tenantId),
  };
  return { ctx };
}

export function errResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function okResponse<T>(data: T, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}

/**
 * Parse query params with safe defaults: page (1-based), pageSize (1..100)
 */
export function parsePaging(req: Request): { page: number; pageSize: number; skip: number } {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20")));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
