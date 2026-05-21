import { z } from "zod";
import { MessageChannel, GuestVipStatus } from "@prisma/client";

// ---------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------

export const createMessageTemplateSchema = z.object({
  name: z.string().min(1).max(80),
  channel: z.nativeEnum(MessageChannel),
  category: z.string().max(60).optional().or(z.literal("")),
  subject: z.string().max(200).optional().or(z.literal("")),
  content: z.string().min(1).max(20_000),
});
export type CreateMessageTemplateInput = z.infer<typeof createMessageTemplateSchema>;

export const updateMessageTemplateSchema = createMessageTemplateSchema.partial();
export type UpdateMessageTemplateInput = z.infer<typeof updateMessageTemplateSchema>;

// ---------------------------------------------------------------------
// Segments — the rule shape that lives in `Segment.rules` (Json)
// ---------------------------------------------------------------------

export const segmentRulesSchema = z.object({
  vipStatus: z.array(z.nativeEnum(GuestVipStatus)).optional(),
  tagIds: z.array(z.string().cuid()).optional(),
  tagMode: z.enum(["any", "all"]).default("any").optional(),
  loyaltyTierIds: z.array(z.string().cuid()).optional(),
  minVisits: z.number().int().min(0).optional(),
  maxVisits: z.number().int().min(0).optional(),
  daysSinceLastVisitMin: z.number().int().min(0).optional(),
  daysSinceLastVisitMax: z.number().int().min(0).optional(),
  marketingEmailOptIn: z.boolean().optional(),
  marketingSmsOptIn: z.boolean().optional(),
});
export type SegmentRules = z.infer<typeof segmentRulesSchema>;

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional().or(z.literal("")),
  rules: segmentRulesSchema,
});
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;

export const updateSegmentSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(400).optional().or(z.literal("")),
  rules: segmentRulesSchema.optional(),
});
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;

// ---------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  segmentId: z.string().cuid(),
  templateId: z.string().cuid().optional(),
  channel: z.nativeEnum(MessageChannel),
  subject: z.string().max(200).optional().or(z.literal("")),
  content: z.string().min(1).max(20_000),
  fromName: z.string().max(80).optional().or(z.literal("")),
  fromEmail: z.string().email().optional().or(z.literal("")),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const sendCampaignSchema = z.object({
  campaignId: z.string().cuid(),
});
export type SendCampaignInput = z.infer<typeof sendCampaignSchema>;
