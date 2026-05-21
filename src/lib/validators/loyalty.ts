import { z } from "zod";

export const updateLoyaltyProgramSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  pointsPerDollar: z.number().min(0).max(100).optional(),
  pointsPerVisit: z.number().int().min(0).max(10000).optional(),
  redemptionRate: z.number().min(0).max(1).optional(),
});
export type UpdateLoyaltyProgramInput = z.infer<typeof updateLoyaltyProgramSchema>;

const hexColor = /^#[0-9A-Fa-f]{6}$/;

export const createTierSchema = z.object({
  name: z.string().min(1).max(40),
  minLifetimePoints: z.number().int().min(0),
  multiplier: z.number().min(0).max(10).default(1),
  perks: z.array(z.string().min(1).max(120)).default([]),
  color: z.string().regex(hexColor).optional().or(z.literal("")),
  displayOrder: z.number().int().min(0).default(0),
});
export type CreateTierInput = z.infer<typeof createTierSchema>;

export const updateTierSchema = createTierSchema.partial();
export type UpdateTierInput = z.infer<typeof updateTierSchema>;

export const createRewardSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  pointsCost: z.number().int().min(1).max(1_000_000),
  isActive: z.boolean().default(true),
});
export type CreateRewardInput = z.infer<typeof createRewardSchema>;

export const updateRewardSchema = createRewardSchema.partial();
export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;

export const adjustPointsSchema = z.object({
  guestId: z.string().cuid(),
  points: z.number().int().refine((n) => n !== 0, "Use a non-zero amount"),
  description: z.string().min(1).max(200),
});
export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;

export const redeemRewardSchema = z.object({
  guestId: z.string().cuid(),
  rewardId: z.string().cuid(),
});
export type RedeemRewardInput = z.infer<typeof redeemRewardSchema>;

export const recordSpendSchema = z.object({
  reservationId: z.string().cuid(),
  spendAmount: z.number().min(0).max(100_000),
});
export type RecordSpendInput = z.infer<typeof recordSpendSchema>;
