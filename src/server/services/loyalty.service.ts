import { Prisma, LoyaltyTransactionType } from "@prisma/client";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import type {
  UpdateLoyaltyProgramInput,
  CreateTierInput,
  UpdateTierInput,
  CreateRewardInput,
  UpdateRewardInput,
  AdjustPointsInput,
} from "@/lib/validators/loyalty";

// ---------------------------------------------------------------------
// Program config
// ---------------------------------------------------------------------

const programInclude = {
  tiers: { orderBy: { displayOrder: "asc" } },
  rewards: { orderBy: { pointsCost: "asc" } },
} satisfies Prisma.LoyaltyProgramInclude;

export type LoyaltyProgramDetail = Prisma.LoyaltyProgramGetPayload<{
  include: typeof programInclude;
}>;

/**
 * Fetch the tenant's loyalty program, creating a default disabled one if it
 * doesn't exist yet. This means /loyalty is never empty — owners land in a
 * sensible setup state.
 */
export async function getOrCreateProgram(
  ctx: AuthedContext,
): Promise<LoyaltyProgramDetail> {
  requirePermission(ctx, "loyalty.view");
  const existing = await ctx.db.loyaltyProgram.findFirst({
    include: programInclude,
  });
  if (existing) return existing;

  return ctx.db.loyaltyProgram.create({
    data: {
      tenantId: ctx.tenantId,
      name: "Loyalty Program",
      description: null,
      isActive: false, // owner must turn it on after configuring
      pointsPerDollar: 1,
      pointsPerVisit: 0,
      redemptionRate: 0.01,
    },
    include: programInclude,
  });
}

export async function updateProgram(ctx: AuthedContext, input: UpdateLoyaltyProgramInput) {
  requirePermission(ctx, "loyalty.manage");
  const program = await getOrCreateProgram(ctx);
  const updated = await ctx.db.loyaltyProgram.update({
    where: { id: program.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.pointsPerDollar !== undefined ? { pointsPerDollar: input.pointsPerDollar } : {}),
      ...(input.pointsPerVisit !== undefined ? { pointsPerVisit: input.pointsPerVisit } : {}),
      ...(input.redemptionRate !== undefined ? { redemptionRate: input.redemptionRate } : {}),
    },
  });
  await writeAudit({
    ctx,
    action: "loyalty.program.updated",
    entityType: "LoyaltyProgram",
    entityId: updated.id,
    changes: { after: input },
  });
  return updated;
}

// ---------------------------------------------------------------------
// Tier management
// ---------------------------------------------------------------------

export async function createTier(ctx: AuthedContext, input: CreateTierInput) {
  requirePermission(ctx, "loyalty.manage");
  const program = await getOrCreateProgram(ctx);
  const dupe = await ctx.db.loyaltyTier.findFirst({
    where: { programId: program.id, name: input.name },
  });
  if (dupe) throw new AuthError(409, `A tier named "${input.name}" already exists`);

  const tier = await ctx.db.loyaltyTier.create({
    data: {
      programId: program.id,
      name: input.name,
      minLifetimePoints: input.minLifetimePoints,
      multiplier: input.multiplier,
      perks: input.perks,
      color: input.color || "#CD7F32",
      displayOrder: input.displayOrder,
    },
  });
  await writeAudit({
    ctx,
    action: "loyalty.tier.created",
    entityType: "LoyaltyTier",
    entityId: tier.id,
    changes: { after: { name: tier.name, minLifetimePoints: tier.minLifetimePoints } },
  });
  return tier;
}

export async function updateTier(ctx: AuthedContext, id: string, input: UpdateTierInput) {
  requirePermission(ctx, "loyalty.manage");
  const existing = await ctx.db.loyaltyTier.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Tier not found");

  const updated = await ctx.db.loyaltyTier.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.minLifetimePoints !== undefined
        ? { minLifetimePoints: input.minLifetimePoints }
        : {}),
      ...(input.multiplier !== undefined ? { multiplier: input.multiplier } : {}),
      ...(input.perks !== undefined ? { perks: input.perks } : {}),
      ...(input.color !== undefined ? { color: input.color || null } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
    },
  });
  await writeAudit({
    ctx,
    action: "loyalty.tier.updated",
    entityType: "LoyaltyTier",
    entityId: id,
    changes: { after: input },
  });
  return updated;
}

export async function deleteTier(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "loyalty.manage");
  await ctx.db.loyaltyTier.delete({ where: { id } });
  await writeAudit({ ctx, action: "loyalty.tier.deleted", entityType: "LoyaltyTier", entityId: id });
}

// ---------------------------------------------------------------------
// Reward catalogue
// ---------------------------------------------------------------------

export async function createReward(ctx: AuthedContext, input: CreateRewardInput) {
  requirePermission(ctx, "loyalty.manage");
  const program = await getOrCreateProgram(ctx);
  const reward = await ctx.db.reward.create({
    data: {
      programId: program.id,
      name: input.name,
      description: input.description || null,
      pointsCost: input.pointsCost,
      isActive: input.isActive,
    },
  });
  await writeAudit({
    ctx,
    action: "loyalty.reward.created",
    entityType: "Reward",
    entityId: reward.id,
    changes: { after: { name: reward.name, pointsCost: reward.pointsCost } },
  });
  return reward;
}

export async function updateReward(ctx: AuthedContext, id: string, input: UpdateRewardInput) {
  requirePermission(ctx, "loyalty.manage");
  const existing = await ctx.db.reward.findUnique({ where: { id } });
  if (!existing) throw new AuthError(404, "Reward not found");
  const updated = await ctx.db.reward.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.pointsCost !== undefined ? { pointsCost: input.pointsCost } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  await writeAudit({
    ctx,
    action: "loyalty.reward.updated",
    entityType: "Reward",
    entityId: id,
    changes: { after: input },
  });
  return updated;
}

// ---------------------------------------------------------------------
// Account lookup / creation
// ---------------------------------------------------------------------

const accountInclude = {
  tier: true,
  program: true,
  transactions: { orderBy: { createdAt: "desc" }, take: 20 },
  redemptions: {
    include: { reward: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  },
} satisfies Prisma.LoyaltyAccountInclude;

export type LoyaltyAccountDetail = Prisma.LoyaltyAccountGetPayload<{
  include: typeof accountInclude;
}>;

export async function getAccountForGuest(
  ctx: AuthedContext,
  guestId: string,
): Promise<LoyaltyAccountDetail | null> {
  requirePermission(ctx, "loyalty.view");
  return ctx.db.loyaltyAccount.findUnique({
    where: { guestId },
    include: accountInclude,
  });
}

/**
 * Internal helper — find or create an account for a guest. Called by the
 * point-awarding paths (reservation completion, manual adjust).
 */
async function ensureAccount(ctx: AuthedContext, guestId: string) {
  const existing = await ctx.db.loyaltyAccount.findUnique({ where: { guestId } });
  if (existing) return existing;
  const program = await getOrCreateProgram(ctx);
  const firstTier = await ctx.db.loyaltyTier.findFirst({
    where: { programId: program.id },
    orderBy: { minLifetimePoints: "asc" },
  });
  return ctx.db.loyaltyAccount.create({
    data: { guestId, programId: program.id, tierId: firstTier?.id ?? null },
  });
}

// ---------------------------------------------------------------------
// Points: earn (auto from reservation), adjust (manual), redeem
// ---------------------------------------------------------------------

/**
 * Award points after a reservation completes. Called from the reservation
 * service's `transitionReservation` when the action is `complete`. Honours
 * the tier multiplier on top of pointsPerVisit + pointsPerDollar × spend.
 *
 * Returns the points awarded (or 0 if the program is disabled / no guest).
 */
export async function awardForReservationComplete(
  ctx: AuthedContext,
  reservationId: string,
): Promise<number> {
  const reservation = await ctx.db.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, guestId: true, spendAmount: true },
  });
  if (!reservation?.guestId) return 0;

  const program = await ctx.db.loyaltyProgram.findFirst();
  if (!program || !program.isActive) return 0;

  const account = await ensureAccount(ctx, reservation.guestId);
  const tier = account.tierId
    ? await ctx.db.loyaltyTier.findUnique({ where: { id: account.tierId } })
    : null;
  const multiplier = tier?.multiplier ?? 1;

  const visitPts = program.pointsPerVisit;
  const spendPts = Math.round((reservation.spendAmount ?? 0) * program.pointsPerDollar);
  const total = Math.round((visitPts + spendPts) * multiplier);
  if (total <= 0) return 0;

  await ctx.db.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      type: LoyaltyTransactionType.EARN,
      points: total,
      description:
        reservation.spendAmount && reservation.spendAmount > 0
          ? `Visit + $${reservation.spendAmount.toFixed(0)} spend`
          : `Visit bonus`,
      reservationId: reservation.id,
    },
  });

  await applyPointsAndRecomputeTier(ctx, account.id, total);
  return total;
}

/**
 * Manual point adjustment by a manager — grant a bonus, write off a complaint,
 * or correct an import error. Audit-logged with the description for compliance.
 */
export async function adjustPoints(ctx: AuthedContext, input: AdjustPointsInput) {
  requirePermission(ctx, "loyalty.manage");
  const account = await ensureAccount(ctx, input.guestId);

  await ctx.db.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      type: LoyaltyTransactionType.ADJUST,
      points: input.points,
      description: input.description,
    },
  });

  await applyPointsAndRecomputeTier(ctx, account.id, input.points);

  await writeAudit({
    ctx,
    action: "loyalty.adjusted",
    entityType: "LoyaltyAccount",
    entityId: account.id,
    changes: {
      after: { points: input.points, reason: input.description, guestId: input.guestId },
    },
  });
}

/**
 * Redeem a reward against an account. Snapshot the points cost at redemption
 * time (so future price changes don't retroactively affect issued codes).
 */
export async function redeemReward(
  ctx: AuthedContext,
  input: { guestId: string; rewardId: string },
) {
  requirePermission(ctx, "loyalty.manage");
  const [account, reward] = await Promise.all([
    ensureAccount(ctx, input.guestId),
    ctx.db.reward.findUnique({ where: { id: input.rewardId } }),
  ]);
  if (!reward) throw new AuthError(404, "Reward not found");
  if (!reward.isActive) throw new AuthError(403, "Reward isn't active");
  if (account.currentPoints < reward.pointsCost) {
    throw new AuthError(
      403,
      `Not enough points — has ${account.currentPoints}, needs ${reward.pointsCost}`,
    );
  }

  const redemption = await ctx.db.rewardRedemption.create({
    data: {
      rewardId: reward.id,
      accountId: account.id,
      pointsCost: reward.pointsCost,
    },
  });

  await ctx.db.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      type: LoyaltyTransactionType.REDEEM,
      points: -reward.pointsCost,
      description: `Redeemed: ${reward.name}`,
    },
  });

  await applyPointsAndRecomputeTier(ctx, account.id, -reward.pointsCost);

  await writeAudit({
    ctx,
    action: "loyalty.redeemed",
    entityType: "RewardRedemption",
    entityId: redemption.id,
    changes: {
      after: {
        guestId: input.guestId,
        reward: reward.name,
        points: reward.pointsCost,
        code: redemption.redemptionCode.slice(0, 8).toUpperCase(),
      },
    },
  });

  return redemption;
}

/**
 * Apply a delta to currentPoints (and lifetimePoints if it's a positive
 * delta), then recompute tier based on the new lifetime total.
 */
async function applyPointsAndRecomputeTier(
  ctx: AuthedContext,
  accountId: string,
  delta: number,
) {
  const account = await ctx.db.loyaltyAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) return;

  const newCurrent = account.currentPoints + delta;
  const newLifetime = delta > 0 ? account.lifetimePoints + delta : account.lifetimePoints;

  // Find the best tier for the new lifetime points
  const tiers = await ctx.db.loyaltyTier.findMany({
    where: { programId: account.programId },
    orderBy: { minLifetimePoints: "desc" },
  });
  const newTier = tiers.find((t) => newLifetime >= t.minLifetimePoints);

  await ctx.db.loyaltyAccount.update({
    where: { id: accountId },
    data: {
      currentPoints: newCurrent,
      lifetimePoints: newLifetime,
      tierId: newTier?.id ?? account.tierId,
    },
  });
}

// ---------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------

export async function getLeaderboard(ctx: AuthedContext, limit = 10) {
  requirePermission(ctx, "loyalty.view");
  const accounts = await ctx.db.loyaltyAccount.findMany({
    orderBy: { lifetimePoints: "desc" },
    take: limit,
    include: {
      guest: { select: { id: true, firstName: true, lastName: true, vipStatus: true } },
      tier: true,
    },
  });
  return accounts;
}

// ---------------------------------------------------------------------
// Recent activity (program-wide)
// ---------------------------------------------------------------------

export async function recentTransactions(ctx: AuthedContext, limit = 20) {
  requirePermission(ctx, "loyalty.view");
  return ctx.db.loyaltyTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      account: {
        include: { guest: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
}
