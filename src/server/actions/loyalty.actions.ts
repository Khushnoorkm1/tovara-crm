"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, AuthError } from "@/server/tenant";
import {
  updateProgram as svcUpdateProgram,
  createTier as svcCreateTier,
  updateTier as svcUpdateTier,
  deleteTier as svcDeleteTier,
  createReward as svcCreateReward,
  updateReward as svcUpdateReward,
  adjustPoints as svcAdjust,
  redeemReward as svcRedeem,
} from "@/server/services/loyalty.service";
import { recordReservationSpend as svcRecordSpend } from "@/server/services/reservation.service";
import {
  updateLoyaltyProgramSchema,
  createTierSchema,
  updateTierSchema,
  createRewardSchema,
  updateRewardSchema,
  adjustPointsSchema,
  redeemRewardSchema,
  recordSpendSchema,
} from "@/lib/validators/loyalty";
import type { ActionResult } from "./reservation.actions";

export async function updateLoyaltyProgramAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateLoyaltyProgramSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    await svcUpdateProgram(ctx, parsed.data);
    revalidatePath("/loyalty");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function createTierAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createTierSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    const tier = await svcCreateTier(ctx, parsed.data);
    revalidatePath("/loyalty");
    return { ok: true, data: { id: tier.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function updateTierAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateTierSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    await svcUpdateTier(ctx, id, parsed.data);
    revalidatePath("/loyalty");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteTierAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    await svcDeleteTier(ctx, id);
    revalidatePath("/loyalty");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function createRewardAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createRewardSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    const reward = await svcCreateReward(ctx, parsed.data);
    revalidatePath("/loyalty");
    return { ok: true, data: { id: reward.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function updateRewardAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateRewardSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    await svcUpdateReward(ctx, id, parsed.data);
    revalidatePath("/loyalty");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function adjustPointsAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = adjustPointsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    await svcAdjust(ctx, parsed.data);
    revalidatePath(`/guests/${parsed.data.guestId}`);
    revalidatePath("/loyalty");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function redeemRewardAction(input: unknown): Promise<ActionResult<{ code: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = redeemRewardSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    const redemption = await svcRedeem(ctx, parsed.data);
    revalidatePath(`/guests/${parsed.data.guestId}`);
    revalidatePath("/loyalty");
    return { ok: true, data: { code: redemption.redemptionCode.slice(0, 8).toUpperCase() } };
  } catch (err) {
    return toError(err);
  }
}

export async function recordSpendAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = recordSpendSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    await svcRecordSpend(ctx, parsed.data.reservationId, parsed.data.spendAmount);
    revalidatePath(`/reservations/${parsed.data.reservationId}`);
    revalidatePath("/loyalty");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[loyalty action] unexpected error:", err);
  return { ok: false, error: "Something went wrong" };
}
