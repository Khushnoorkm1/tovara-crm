"use server";

import { revalidatePath } from "next/cache";
import { WaitlistStatus } from "@prisma/client";
import { requireAuth, AuthError } from "@/server/tenant";
import {
  createWaitlistEntry as svcCreate,
  updateWaitlistStatus as svcUpdateStatus,
} from "@/server/services/waitlist.service";
import { createWaitlistSchema, updateWaitlistStatusSchema } from "@/lib/validators/waitlist";
import type { ActionResult } from "./reservation.actions";

export async function createWaitlistAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createWaitlistSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return { ok: false, error: first?.message ?? "Validation failed", field: first?.path?.[0]?.toString() };
    }
    const e = await svcCreate(ctx, parsed.data);
    revalidatePath("/waitlist");
    return { ok: true, data: { id: e.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function updateWaitlistStatusAction(
  id: string,
  status: WaitlistStatus,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateWaitlistStatusSchema.safeParse({ status });
    if (!parsed.success) {
      return { ok: false, error: "Invalid status" };
    }
    await svcUpdateStatus(ctx, id, parsed.data.status);
    revalidatePath("/waitlist");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[action] unexpected error:", err);
  return { ok: false, error: "Something went wrong" };
}
