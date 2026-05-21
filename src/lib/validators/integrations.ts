import { z } from "zod";

// ---------------------------------------------------------------------
// Stripe / deposit configuration
// ---------------------------------------------------------------------

export const updateStripeSettingsSchema = z.object({
  enabled: z.boolean(),
  publishableKey: z.string().max(200).optional().or(z.literal("")),
  secretKey: z.string().max(200).optional().or(z.literal("")),
  webhookSecret: z.string().max(200).optional().or(z.literal("")),
});
export type UpdateStripeSettingsInput = z.infer<typeof updateStripeSettingsSchema>;

export const updateDepositSettingsSchema = z.object({
  depositPerPerson: z.number().min(0).max(1000).nullable(),
  depositRefundPolicy: z.string().max(500).optional().or(z.literal("")),
});
export type UpdateDepositSettingsInput = z.infer<typeof updateDepositSettingsSchema>;

// ---------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------

export const API_SCOPES = [
  "reservation:read",
  "reservation:write",
  "guest:read",
  "guest:write",
  "table:read",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  expiresAt: z.string().datetime().optional().nullable(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// ---------------------------------------------------------------------
// Webhook endpoints
// ---------------------------------------------------------------------

export const WEBHOOK_EVENTS = [
  "reservation.created",
  "reservation.updated",
  "reservation.seated",
  "reservation.completed",
  "reservation.cancelled",
  "reservation.no_show",
  "guest.created",
  "payment.authorized",
  "payment.refunded",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// ---------------------------------------------------------------------
// Public API — reservation create shape (subset of host-side schema)
// ---------------------------------------------------------------------

export const apiCreateReservationSchema = z.object({
  startTime: z.string().datetime(),
  partySize: z.number().int().min(1).max(50),
  guest: z.object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().max(80).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
  }),
  occasion: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
});
export type ApiCreateReservationInput = z.infer<typeof apiCreateReservationSchema>;

export const apiCreateGuestSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  marketingEmailOptIn: z.boolean().optional(),
});
export type ApiCreateGuestInput = z.infer<typeof apiCreateGuestSchema>;
