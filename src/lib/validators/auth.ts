import { z } from "zod";
import { RESERVED_TENANT_SLUGS } from "@/lib/constants";

export const loginSchema = z.object({
  email: z.string().min(1, "Required").email("Invalid email"),
  password: z.string().min(1, "Required"),
  tenantSlug: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

const slugSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(40, "At most 40 characters")
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only")
  .refine((s) => !s.startsWith("-") && !s.endsWith("-"), "Cannot start or end with a hyphen")
  .refine((s) => !RESERVED_TENANT_SLUGS.has(s), "This subdomain is reserved");

export const registerSchema = z.object({
  // Owner
  name: z.string().min(1, "Required").max(100),
  email: z.string().min(1, "Required").email("Invalid email"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Za-z]/, "Must contain a letter")
    .regex(/[0-9]/, "Must contain a number"),

  // Restaurant
  restaurantName: z.string().min(1, "Required").max(120),
  slug: slugSchema,
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
});
export type RegisterInput = z.infer<typeof registerSchema>;
