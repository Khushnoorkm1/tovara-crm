import { z } from "zod";
import { ReservationSource, ReservationStatus } from "@prisma/client";

const phoneRegex = /^\+?[0-9 ()\-]{7,20}$/;

/**
 * Create a reservation. The host either picks an existing guest (guestId) or
 * provides walk-in guest fields directly. We accept both shapes; the service
 * upserts a Guest if guestId is missing.
 */
export const createReservationSchema = z
  .object({
    // When time
    reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
    durationMinutes: z.number().int().min(30).max(480).optional(),

    // Who
    partySize: z.number().int().min(1).max(20),
    guestId: z
      .preprocess((v) => (v === "" ? undefined : v), z.string().cuid().optional()),
    guestFirstName: z.string().min(1).max(80).optional(),
    guestLastName: z.string().max(80).optional().or(z.literal("")),
    guestEmail: z.string().email().optional().or(z.literal("")),
    guestPhone: z.string().regex(phoneRegex, "Invalid phone").optional().or(z.literal("")),

    // Where
    tableId: z
      .preprocess((v) => (v === "" ? undefined : v), z.string().cuid().optional()),

    // Extras
    occasion: z.string().max(60).optional().or(z.literal("")),
    specialRequests: z.string().max(500).optional().or(z.literal("")),
    dietaryNotes: z.string().max(500).optional().or(z.literal("")),

    source: z.nativeEnum(ReservationSource).default(ReservationSource.HOST),
  })
  .refine((d) => d.guestId || d.guestFirstName, {
    message: "Pick an existing guest or provide a name",
    path: ["guestFirstName"],
  });

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

/**
 * Patch — every field optional. Identical shape minus the cross-field refinement.
 */
export const updateReservationSchema = z.object({
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMinutes: z.number().int().min(30).max(480).optional(),
  partySize: z.number().int().min(1).max(20).optional(),
  tableId: z.string().cuid().nullable().optional(),
  occasion: z.string().max(60).nullable().optional(),
  specialRequests: z.string().max(500).nullable().optional(),
  dietaryNotes: z.string().max(500).nullable().optional(),
  status: z.nativeEnum(ReservationStatus).optional(),
});

export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;

/**
 * State transitions — separate from `update` so we can require permission
 * differently and write a clean action verb to the audit log.
 */
export const reservationTransitionSchema = z.object({
  action: z.enum(["seat", "complete", "no_show", "cancel"]),
  cancellationReason: z.string().max(200).optional(),
});

export type ReservationTransitionInput = z.infer<typeof reservationTransitionSchema>;

/**
 * Availability lookup — used by the create form to compute open slots.
 */
export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(20),
});

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
