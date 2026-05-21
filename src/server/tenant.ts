import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "./auth";
import { hasPermission, type Permission } from "./rbac";
import { prisma, tenantDb, type TenantDb } from "./db";
import { UserRole } from "@prisma/client";
import { extractSubdomain } from "@/lib/subdomain";

export { extractSubdomain };

/**
 * Standard authenticated session shape — what callers can rely on.
 */
export type AuthedContext = {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string | null;
  db: TenantDb;
};

/**
 * Authorization errors throw this — route handlers catch and turn into 401/403.
 */
export class AuthError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 502,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Use in server components / actions / route handlers when sign-in is required.
 * Throws AuthError(401) if not signed in, AuthError(403) if no tenant.
 *
 * Returns a context with a tenant-scoped Prisma client.
 */
export async function requireAuth(): Promise<AuthedContext> {
  const session = await auth();
  if (!session?.user) throw new AuthError(401, "Not authenticated");
  const { id: userId, tenantId, role, email, name } = session.user;
  if (!tenantId) throw new AuthError(403, "No tenant context");
  return {
    userId,
    tenantId,
    role,
    email: email ?? "",
    name: name ?? null,
    db: tenantDb(tenantId),
  };
}

/**
 * Server component variant — redirects to /login instead of throwing.
 * Use this in page.tsx files at the top of the function.
 */
export async function requireAuthOrRedirect(): Promise<AuthedContext> {
  try {
    return await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) redirect("/login");
    throw err;
  }
}

/**
 * Throw 403 if the role lacks the required permission.
 */
export function requirePermission(ctx: AuthedContext, permission: Permission): void {
  if (!hasPermission(ctx.role, permission)) {
    throw new AuthError(403, `Permission denied: ${permission}`);
  }
}

/**
 * Resolve the current tenant from request host (subdomain).
 * Falls back to null if not on a tenant subdomain.
 *
 * Useful for the public booking widget and the login page (to scope login
 * to the tenant whose subdomain the user landed on).
 */
export async function getTenantFromHost(): Promise<{ id: string; slug: string; name: string } | null> {
  const h = await headers();
  const host = h.get("host") ?? "";
  const slug = extractSubdomain(host);
  if (!slug) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, isActive: true },
  });
  if (!tenant || !tenant.isActive) return null;
  return { id: tenant.id, slug: tenant.slug, name: tenant.name };
}
