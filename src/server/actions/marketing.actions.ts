"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, AuthError } from "@/server/tenant";
import {
  createTemplate as svcCreateTpl,
  updateTemplate as svcUpdateTpl,
  deleteTemplate as svcDeleteTpl,
} from "@/server/services/message-template.service";
import {
  createSegment as svcCreateSeg,
  updateSegment as svcUpdateSeg,
  deleteSegment as svcDeleteSeg,
  previewSegmentCount as svcPreviewSeg,
  refreshSegmentMembers as svcRefreshSeg,
} from "@/server/services/segment.service";
import {
  createCampaign as svcCreateCampaign,
  sendCampaign as svcSendCampaign,
} from "@/server/services/campaign.service";
import {
  createMessageTemplateSchema,
  updateMessageTemplateSchema,
  createSegmentSchema,
  updateSegmentSchema,
  segmentRulesSchema,
  createCampaignSchema,
  sendCampaignSchema,
} from "@/lib/validators/marketing";
import type { ActionResult } from "./reservation.actions";

// ---- Templates ----

export async function createTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createMessageTemplateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    const tpl = await svcCreateTpl(ctx, parsed.data);
    revalidatePath("/marketing");
    return { ok: true, data: { id: tpl.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function updateTemplateAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateMessageTemplateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    await svcUpdateTpl(ctx, id, parsed.data);
    revalidatePath("/marketing");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    await svcDeleteTpl(ctx, id);
    revalidatePath("/marketing");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

// ---- Segments ----

export async function createSegmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createSegmentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    const seg = await svcCreateSeg(ctx, parsed.data);
    revalidatePath("/marketing");
    return { ok: true, data: { id: seg.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function updateSegmentAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateSegmentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    await svcUpdateSeg(ctx, id, parsed.data);
    revalidatePath("/marketing");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteSegmentAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    await svcDeleteSeg(ctx, id);
    revalidatePath("/marketing");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function previewSegmentAction(rules: unknown): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireAuth();
    const parsed = segmentRulesSchema.safeParse(rules);
    if (!parsed.success) return { ok: false, error: "Invalid rules" };
    const count = await svcPreviewSeg(ctx, parsed.data);
    return { ok: true, data: { count } };
  } catch (err) {
    return toError(err);
  }
}

export async function refreshSegmentAction(id: string): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireAuth();
    const count = (await svcRefreshSeg(ctx, id)) ?? 0;
    revalidatePath("/marketing");
    return { ok: true, data: { count } };
  } catch (err) {
    return toError(err);
  }
}

// ---- Campaigns ----

export async function createCampaignAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createCampaignSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    const campaign = await svcCreateCampaign(ctx, parsed.data);
    revalidatePath("/marketing");
    return { ok: true, data: { id: campaign.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function sendCampaignAction(input: unknown): Promise<ActionResult<{ sent: number; failed: number; total: number }>> {
  try {
    const ctx = await requireAuth();
    const parsed = sendCampaignSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid" };
    const result = await svcSendCampaign(ctx, parsed.data.campaignId);
    revalidatePath("/marketing");
    return { ok: true, data: result };
  } catch (err) {
    return toError(err);
  }
}

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[marketing action] unexpected error:", err);
  return { ok: false, error: "Something went wrong" };
}
