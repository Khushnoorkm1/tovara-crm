"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, AuthError } from "@/server/tenant";
import {
  createGuest as svcCreate,
  updateGuest as svcUpdate,
  deleteGuest as svcDelete,
} from "@/server/services/guest.service";
import { createGuestSchema, updateGuestSchema } from "@/lib/validators/guest";
import type { ActionResult } from "./reservation.actions";

export async function createGuestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createGuestSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return { ok: false, error: first?.message ?? "Validation failed", field: first?.path?.[0]?.toString() };
    }
    const guest = await svcCreate(ctx, parsed.data);
    revalidatePath("/guests");
    return { ok: true, data: { id: guest.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function updateGuestAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateGuestSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return { ok: false, error: first?.message ?? "Validation failed", field: first?.path?.[0]?.toString() };
    }
    await svcUpdate(ctx, id, parsed.data);
    revalidatePath("/guests");
    revalidatePath(`/guests/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteGuestAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    await svcDelete(ctx, id);
    revalidatePath("/guests");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[guest action] unexpected error:", err);
  return { ok: false, error: "Something went wrong" };
}
