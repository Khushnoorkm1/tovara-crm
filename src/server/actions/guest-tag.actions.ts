"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, AuthError } from "@/server/tenant";
import {
  createGuestTag as svcCreate,
  assignGuestTag as svcAssign,
  unassignGuestTag as svcUnassign,
} from "@/server/services/guest-tag.service";
import {
  createGuestTagSchema,
  assignGuestTagSchema,
} from "@/lib/validators/guest-tag";
import type { ActionResult } from "./reservation.actions";

export async function createGuestTagAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createGuestTagSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }
    const tag = await svcCreate(ctx, parsed.data);
    revalidatePath("/guests");
    return { ok: true, data: { id: tag.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function assignGuestTagAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = assignGuestTagSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }
    await svcAssign(ctx, parsed.data);
    revalidatePath(`/guests/${parsed.data.guestId}`);
    revalidatePath("/guests");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function unassignGuestTagAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = assignGuestTagSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }
    await svcUnassign(ctx, parsed.data);
    revalidatePath(`/guests/${parsed.data.guestId}`);
    revalidatePath("/guests");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[tag action] unexpected error:", err);
  return { ok: false, error: "Something went wrong" };
}
