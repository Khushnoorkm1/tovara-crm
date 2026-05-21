import { z } from "zod";
import { GuestVipStatus } from "@prisma/client";

const phoneRegex = /^\+?[0-9 ()\-]{7,20}$/;

/**
 * Create a new guest. Only firstName is strictly required — restaurants often
 * have partial info ("the Smith party in for tomorrow at 7"), and we let them
 * fill in details later.
 */
export const createGuestSchema = z.object({
  firstName: z.string().min(1, "Required").max(80),
  lastName: z.string().max(80).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().regex(phoneRegex, "Invalid phone").optional().or(z.literal("")),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").optional().or(z.literal("")),

  addressLine1: z.string().max(120).optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  state: z.string().max(40).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),

  vipStatus: z.nativeEnum(GuestVipStatus).default(GuestVipStatus.NONE),

  dietaryRestrictions: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
  favoriteSeating: z.string().max(80).optional().or(z.literal("")),

  marketingEmailOptIn: z.boolean().default(false),
  marketingSmsOptIn: z.boolean().default(false),
});

export type CreateGuestInput = z.infer<typeof createGuestSchema>;

/**
 * Patch — every field optional.
 */
export const updateGuestSchema = createGuestSchema.partial();
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
