import { z } from "zod";

export const createGuestNoteSchema = z.object({
  guestId: z.string().cuid(),
  content: z.string().min(1, "Required").max(2000),
  isPinned: z.boolean().default(false),
});
export type CreateGuestNoteInput = z.infer<typeof createGuestNoteSchema>;

export const updateGuestNoteSchema = z.object({
  content: z.string().min(1, "Required").max(2000).optional(),
  isPinned: z.boolean().optional(),
});
export type UpdateGuestNoteInput = z.infer<typeof updateGuestNoteSchema>;
