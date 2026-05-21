"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, AuthError } from "@/server/tenant";
import {
  createReservation as svcCreate,
  updateReservation as svcUpdate,
  transitionReservation as svcTransition,
} from "@/server/services/reservation.service";
import {
  createReservationSchema,
  updateReservationSchema,
  reservationTransitionSchema,
} from "@/lib/validators/reservation";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export async function createReservationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    const parsed = createReservationSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return { ok: false, error: first?.message ?? "Validation failed", field: first?.path?.[0]?.toString() };
    }
    const r = await svcCreate(ctx, parsed.data);
    revalidatePath("/reservations");
    revalidatePath("/dashboard");
    revalidatePath("/floor");
    return { ok: true, data: { id: r.id } };
  } catch (err) {
    return toError(err);
  }
}

export async function updateReservationAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = updateReservationSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return { ok: false, error: first?.message ?? "Validation failed", field: first?.path?.[0]?.toString() };
    }
    await svcUpdate(ctx, id, parsed.data);
    revalidatePath("/reservations");
    revalidatePath(`/reservations/${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/floor");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function transitionReservationAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    const parsed = reservationTransitionSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }
    await svcTransition(ctx, id, parsed.data);
    revalidatePath("/reservations");
    revalidatePath(`/reservations/${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/floor");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

/**
 * Quick-assign a table from the floor view.
 * Convenience wrapper around updateReservationAction.
 */
export async function assignTableAction(
  reservationId: string,
  tableId: string | null,
): Promise<ActionResult> {
  return updateReservationAction(reservationId, { tableId });
}

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[action] unexpected error:", err);
  return { ok: false, error: "Something went wrong" };
}
