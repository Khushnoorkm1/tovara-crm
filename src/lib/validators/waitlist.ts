import { z } from "zod";
import { WaitlistStatus } from "@prisma/client";

const phoneRegex = /^\+?[0-9 ()\-]{7,20}$/;

export const createWaitlistSchema = z.object({
  guestName: z.string().min(1, "Required").max(80),
  guestPhone: z.string().regex(phoneRegex, "Invalid phone").optional().or(z.literal("")),
  partySize: z.number().int().min(1).max(20),
  quotedWaitMinutes: z.number().int().min(0).max(240).optional(),
  notes: z.string().max(200).optional().or(z.literal("")),
});
export type CreateWaitlistInput = z.infer<typeof createWaitlistSchema>;

export const updateWaitlistStatusSchema = z.object({
  status: z.nativeEnum(WaitlistStatus),
});
export type UpdateWaitlistStatusInput = z.infer<typeof updateWaitlistStatusSchema>;
