import { z } from "zod";

const hexColor = /^#[0-9A-Fa-f]{6}$/;

export const createGuestTagSchema = z.object({
  name: z.string().min(1, "Required").max(40),
  color: z.string().regex(hexColor, "Use a hex color like #B5462E").optional().or(z.literal("")),
});
export type CreateGuestTagInput = z.infer<typeof createGuestTagSchema>;

export const assignGuestTagSchema = z.object({
  guestId: z.string().cuid(),
  tagId: z.string().cuid(),
});
export type AssignGuestTagInput = z.infer<typeof assignGuestTagSchema>;
