/**
 * Token-based template renderer. Replaces `{{token}}` (whitespace tolerated)
 * with values from the context object. Unknown tokens render as empty so a
 * typo in a template never crashes a campaign send.
 *
 * Example:
 *   render("Hi {{firstName}}, see you {{date}}", { firstName: "Mario", date: "Friday" })
 *   → "Hi Mario, see you Friday"
 */

export function renderTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

/**
 * Extract the unique tokens from a template — used to suggest variables to
 * authors when they hit save.
 */
export function extractTokens(template: string): string[] {
  const matches = template.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);
  const set = new Set<string>();
  for (const m of matches) if (m[1]) set.add(m[1]);
  return [...set];
}

/**
 * Tokens that the system always exposes for transactional and campaign
 * templates. Authors can use any subset; missing values render as empty.
 */
export const SUPPORTED_TOKENS = [
  // Guest
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  // Restaurant
  "restaurantName",
  "restaurantPhone",
  "restaurantAddress",
  // Reservation (only present in transactional contexts)
  "reservationDate",
  "reservationTime",
  "partySize",
  "confirmationCode",
  "occasion",
  // Loyalty
  "currentPoints",
  "tierName",
] as const;

export type SupportedToken = (typeof SUPPORTED_TOKENS)[number];
