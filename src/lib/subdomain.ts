/**
 * Edge-safe subdomain extraction. No server-only imports, so this is safe to
 * use from middleware.ts (Edge runtime) as well as server components.
 *
 * Examples:
 *   marios-bistro.app.com         → "marios-bistro"
 *   marios-bistro.localhost:3000  → "marios-bistro"
 *   app.com                       → null
 *   localhost:3000                → null
 *   www.app.com                   → null  (reserved)
 */
const RESERVED = new Set(["www", "api", "admin", "app", "auth"]);

export function extractSubdomain(host: string): string | null {
  if (!host) return null;
  const cleanHost = host.split(":")[0]!; // strip port
  const parts = cleanHost.split(".");

  // localhost cases:
  //   localhost          → 1 part, no subdomain
  //   sub.localhost      → 2+ parts, sub is subdomain
  if (cleanHost.endsWith("localhost")) {
    if (parts.length < 2) return null;
    const sub = parts[0]!;
    return RESERVED.has(sub) ? null : sub;
  }

  // Production: app.com (2 parts) → no subdomain; sub.app.com (3+ parts) → sub
  if (parts.length < 3) return null;
  const sub = parts[0]!;
  return RESERVED.has(sub) ? null : sub;
}
