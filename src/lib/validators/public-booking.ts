import { z } from "zod";

const phoneRegex = /^\+?[0-9 ()\-]{7,20}$/;

/**
 * What a guest submits when booking online. Differences from the internal
 * createReservationSchema:
 *   - No guestId (guest is unknown to the system at this moment)
 *   - Name + email + phone all required (we need to confirm with them)
 *   - No source field — always ONLINE_WIDGET on the server
 *   - No tableId — host assigns later
 */
export const publicBookingSchema = z.object({
  // Tenant scoping comes from the URL path, not the body — but we include it
  // for the server action so it can verify against the route param.
  tenantSlug: z.string().min(1),

  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  partySize: z.number().int().min(1).max(20),

  guestFirstName: z.string().min(1, "Required").max(80),
  guestLastName: z.string().min(1, "Required").max(80),
  guestEmail: z.string().email("Invalid email"),
  guestPhone: z.string().regex(phoneRegex, "Invalid phone"),

  occasion: z.string().max(60).optional().or(z.literal("")),
  specialRequests: z.string().max(500).optional().or(z.literal("")),
});

export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

/**
 * Lookup query for the public availability API.
 */
export const publicAvailabilityQuerySchema = z.object({
  tenantSlug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(20),
});

export type PublicAvailabilityQueryInput = z.infer<typeof publicAvailabilityQuerySchema>;
