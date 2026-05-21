"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DayOfWeek, UserRole } from "@prisma/client";
import { requireAuth, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import type { ActionResult } from "./reservation.actions";

// ---------------------------------------------------------------------
// Operating hours
// ---------------------------------------------------------------------

const hoursShiftSchema = z.object({
  id: z.string().optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  shiftName: z.string().max(40).optional(),
  isClosed: z.boolean().optional(),
});

const hoursPayloadSchema = z.object({
  shifts: z.array(hoursShiftSchema),
});

export async function saveOperatingHoursAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!["OWNER", "ADMIN", "MANAGER"].includes(ctx.role)) {
      return { ok: false, error: "Only managers and above can edit operating hours" };
    }
    const parsed = hoursPayloadSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid input" };

    // Replace strategy — simplest correct approach. The seed creates these
    // rows so deletion+recreate is the natural shape.
    await ctx.db.operatingHours.deleteMany({});
    if (parsed.data.shifts.length > 0) {
      await ctx.db.operatingHours.createMany({
        data: parsed.data.shifts.map((s) => ({
          tenantId: ctx.tenantId,
          dayOfWeek: s.dayOfWeek,
          openTime: s.openTime,
          closeTime: s.closeTime,
          shiftName: s.shiftName ?? null,
          isClosed: s.isClosed ?? false,
        })),
      });
    }
    await writeAudit({
      ctx,
      action: "settings.hours.updated",
      entityType: "OperatingHours",
      entityId: ctx.tenantId,
      changes: { after: { shifts: parsed.data.shifts.length } },
    });
    revalidatePath("/settings/hours");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

// ---------------------------------------------------------------------
// Reservation rules
// ---------------------------------------------------------------------

const rulesSchema = z.object({
  advanceBookingDays: z.number().int().min(1).max(365),
  minLeadTimeMinutes: z.number().int().min(0).max(10080),
  slotDurationMinutes: z.number().int().min(5).max(60),
  defaultDiningDurationMin: z.number().int().min(15).max(360),
  maxPartySize: z.number().int().min(1).max(50),
  largePartyThreshold: z.number().int().min(1).max(50),
  autoConfirm: z.boolean(),
  allowWaitlist: z.boolean(),
  sendConfirmationEmail: z.boolean(),
  sendReminderEmail: z.boolean(),
  reminderHoursBefore: z.number().int().min(1).max(168),
});

export async function saveReservationRulesAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!["OWNER", "ADMIN", "MANAGER"].includes(ctx.role)) {
      return { ok: false, error: "Only managers and above can edit reservation rules" };
    }
    const parsed = rulesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };

    await ctx.db.reservationSettings.update({
      where: { tenantId: ctx.tenantId },
      data: parsed.data,
    });
    await writeAudit({
      ctx,
      action: "settings.rules.updated",
      entityType: "ReservationSettings",
      entityId: ctx.tenantId,
      changes: { after: parsed.data },
    });
    revalidatePath("/settings/rules");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

// ---------------------------------------------------------------------
// Team management
// ---------------------------------------------------------------------

const updateUserRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(UserRole),
});

export async function updateUserRoleAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!["OWNER", "ADMIN"].includes(ctx.role)) {
      return { ok: false, error: "Only owners and admins can change roles" };
    }
    const parsed = updateUserRoleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid input" };

    const target = await ctx.db.user.findUnique({ where: { id: parsed.data.userId } });
    if (!target) return { ok: false, error: "User not found" };
    if (target.id === ctx.userId) {
      return { ok: false, error: "You can't change your own role" };
    }
    if (target.role === "OWNER" && ctx.role !== "OWNER") {
      return { ok: false, error: "Only an owner can change another owner's role" };
    }
    if (parsed.data.role === "OWNER" && ctx.role !== "OWNER") {
      return { ok: false, error: "Only an owner can promote someone to owner" };
    }

    await ctx.db.user.update({
      where: { id: parsed.data.userId },
      data: { role: parsed.data.role },
    });
    await writeAudit({
      ctx,
      action: "team.role.updated",
      entityType: "User",
      entityId: parsed.data.userId,
      changes: { before: { role: target.role }, after: { role: parsed.data.role } },
    });
    revalidatePath("/settings/team");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function deactivateUserAction(userId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!["OWNER", "ADMIN"].includes(ctx.role)) {
      return { ok: false, error: "Only owners and admins can deactivate users" };
    }
    if (userId === ctx.userId) return { ok: false, error: "You can't deactivate yourself" };
    const target = await ctx.db.user.findUnique({ where: { id: userId } });
    if (!target) return { ok: false, error: "User not found" };
    if (target.role === "OWNER" && ctx.role !== "OWNER") {
      return { ok: false, error: "Only an owner can deactivate another owner" };
    }
    await ctx.db.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    await writeAudit({
      ctx,
      action: "team.deactivated",
      entityType: "User",
      entityId: userId,
    });
    revalidatePath("/settings/team");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

export async function reactivateUserAction(userId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!["OWNER", "ADMIN"].includes(ctx.role)) {
      return { ok: false, error: "Only owners and admins can reactivate users" };
    }
    await ctx.db.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
    revalidatePath("/settings/team");
    return { ok: true, data: undefined };
  } catch (err) {
    return toError(err);
  }
}

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[settings action] unexpected:", err);
  return { ok: false, error: "Something went wrong" };
}
