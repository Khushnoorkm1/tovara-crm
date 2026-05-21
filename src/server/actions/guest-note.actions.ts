"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, AuthError } from "@/server/tenant";
import {
  createGuestNote as svcCreate,
  updateGuestNote as svcUpdate,
  deleteGuestNote as svcDelete,
} from "@/server/services/guest-note.service";
import {
  createGuestNoteSchema,
  updateGuestNoteSchema,
} from "@/lib/validators/guest-note";
import type { ActionResult } from "./reservation.actions";

export async function createGuestNoteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createGuestNoteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }
    const note = await svcCreate(ctx, parsed.data);
    revalidatePath(`/guests/${parsed.data.guestId}`);
    return { ok: true, data: { id: note.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function updateGuestNoteAction(
  id: string,
  guestId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateGuestNoteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }
    await svcUpdate(ctx, id, parsed.data);
    revalidatePath(`/guests/${guestId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteGuestNoteAction(id: string, guestId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    await svcDelete(ctx, id);
    revalidatePath(`/guests/${guestId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[note action] unexpected error:", err);
  return { ok: false, error: "Something went wrong" };
}
