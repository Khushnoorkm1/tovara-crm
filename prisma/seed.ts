/**
 * Seed: Mario's Bistro
 *
 * Creates one demo tenant with:
 *   - 5 users (one per role) — all password: "password123"
 *   - 2 floor sections + 10 tables
 *   - operating hours (closed Mondays)
 *   - reservation settings
 *   - 200 guests with realistic data
 *   - 500 reservations (300 past, 200 future) with realistic statuses
 *   - guest tags (manual + auto)
 *   - guest notes
 *   - audit log entries
 *
 * Run with: pnpm db:seed
 */

import {
  PrismaClient,
  UserRole,
  TableShape,
  DayOfWeek,
  GuestVipStatus,
  ReservationStatus,
  ReservationSource,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Deterministic seed so re-runs produce the same data
faker.seed(20260510);

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function pickWeighted<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1]!.value;
}

function setTime(date: Date, hour: number, minute: number) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

// ---------------------------------------------------------------------
// main
// ---------------------------------------------------------------------

async function main() {
  console.log("🌱  Seeding database…");

  // Clean existing demo data so seed is idempotent
  await prisma.tenant.deleteMany({ where: { slug: "marios-bistro" } });

  // -------------------------------------------------------------------
  // 1. Tenant
  // -------------------------------------------------------------------
  const tenant = await prisma.tenant.create({
    data: {
      slug: "marios-bistro",
      name: "Mario's Bistro",
      primaryColor: "#B5462E",
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      contactEmail: "hello@mariosbistro.com",
      contactPhone: "+12125550100",
      websiteUrl: "https://mariosbistro.com",
      addressLine1: "215 Mulberry St",
      city: "New York",
      state: "NY",
      postalCode: "10012",
      country: "US",
      cuisineType: "Italian",
      priceRange: 3,
      isActive: true,
      onboardingDone: true,
    },
  });
  console.log(`  ✓ tenant: ${tenant.name}`);

  // -------------------------------------------------------------------
  // 2. Subscription
  // -------------------------------------------------------------------
  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      plan: SubscriptionPlan.PROFESSIONAL,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60_000),
    },
  });

  // -------------------------------------------------------------------
  // 3. Users (one per role)
  // -------------------------------------------------------------------
  const password = await bcrypt.hash("password123", 10);
  const userSpecs: { email: string; name: string; role: UserRole }[] = [
    { email: "owner@mariosbistro.com", name: "Mario Romano", role: UserRole.OWNER },
    { email: "admin@mariosbistro.com", name: "Sofia Bianchi", role: UserRole.ADMIN },
    { email: "manager@mariosbistro.com", name: "Luca Conti", role: UserRole.MANAGER },
    { email: "host@mariosbistro.com", name: "Elena Russo", role: UserRole.HOST },
    { email: "staff@mariosbistro.com", name: "Marco Greco", role: UserRole.STAFF },
  ];

  const users = await Promise.all(
    userSpecs.map((spec) =>
      prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: spec.email,
          name: spec.name,
          hashedPassword: password,
          role: spec.role,
          emailVerified: new Date(),
          isActive: true,
        },
      }),
    ),
  );
  console.log(`  ✓ users: ${users.length} (password: "password123")`);

  const owner = users.find((u) => u.role === UserRole.OWNER)!;
  const host = users.find((u) => u.role === UserRole.HOST)!;

  // -------------------------------------------------------------------
  // 4. Floor sections + tables
  // -------------------------------------------------------------------
  const mainDining = await prisma.floorSection.create({
    data: { tenantId: tenant.id, name: "Main Dining", displayOrder: 0 },
  });
  const patio = await prisma.floorSection.create({
    data: { tenantId: tenant.id, name: "Patio", displayOrder: 1 },
  });

  const tableSpecs = [
    { name: "T1", section: mainDining.id, min: 2, max: 2, shape: TableShape.ROUND },
    { name: "T2", section: mainDining.id, min: 2, max: 2, shape: TableShape.ROUND },
    { name: "T3", section: mainDining.id, min: 2, max: 4, shape: TableShape.SQUARE },
    { name: "T4", section: mainDining.id, min: 4, max: 4, shape: TableShape.SQUARE },
    { name: "T5", section: mainDining.id, min: 4, max: 6, shape: TableShape.RECTANGLE },
    { name: "T6", section: mainDining.id, min: 6, max: 8, shape: TableShape.RECTANGLE },
    { name: "B1", section: mainDining.id, min: 1, max: 2, shape: TableShape.BOOTH },
    { name: "B2", section: mainDining.id, min: 2, max: 4, shape: TableShape.BOOTH },
    { name: "P1", section: patio.id, min: 2, max: 4, shape: TableShape.ROUND },
    { name: "P2", section: patio.id, min: 4, max: 6, shape: TableShape.RECTANGLE },
  ];

  const tables = await Promise.all(
    tableSpecs.map((t, i) =>
      prisma.table.create({
        data: {
          tenantId: tenant.id,
          sectionId: t.section,
          name: t.name,
          minCapacity: t.min,
          maxCapacity: t.max,
          shape: t.shape,
          positionX: 80 + (i % 4) * 140,
          positionY: 80 + Math.floor(i / 4) * 140,
        },
      }),
    ),
  );
  console.log(`  ✓ tables: ${tables.length}`);

  // -------------------------------------------------------------------
  // 5. Operating hours (closed Mondays; lunch + dinner Tue–Sun)
  // -------------------------------------------------------------------
  const days: DayOfWeek[] = [
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ];
  for (const day of days) {
    if (day === DayOfWeek.MONDAY) {
      await prisma.operatingHours.create({
        data: {
          tenantId: tenant.id,
          dayOfWeek: day,
          openTime: "00:00",
          closeTime: "00:00",
          isClosed: true,
          shiftName: "Closed",
        },
      });
    } else {
      await prisma.operatingHours.createMany({
        data: [
          {
            tenantId: tenant.id,
            dayOfWeek: day,
            openTime: "11:30",
            closeTime: "14:30",
            shiftName: "Lunch",
          },
          {
            tenantId: tenant.id,
            dayOfWeek: day,
            openTime: "17:00",
            closeTime: "22:30",
            shiftName: "Dinner",
          },
        ],
      });
    }
  }

  // -------------------------------------------------------------------
  // 6. Reservation settings
  // -------------------------------------------------------------------
  await prisma.reservationSettings.create({
    data: {
      tenantId: tenant.id,
      advanceBookingDays: 60,
      slotDurationMinutes: 15,
      defaultDiningDurationMin: 90,
      maxPartySize: 12,
      largePartyThreshold: 8,
      autoConfirm: true,
      allowWaitlist: true,
      sendConfirmationEmail: true,
      sendReminderEmail: true,
      sendReminderSms: true,
      reminderHoursBefore: 24,
    },
  });

  // -------------------------------------------------------------------
  // 7. Guest tags (manual + auto)
  // -------------------------------------------------------------------
  const tags = await Promise.all(
    [
      { name: "VIP", color: "#B5462E", isAuto: false },
      { name: "Foodie", color: "#2D6A4F", isAuto: false },
      { name: "Wine Lover", color: "#722F37", isAuto: false },
      { name: "Big Spender", color: "#C77C2E", isAuto: true, rule: { totalSpend: { gte: 500 } } },
      { name: "Frequent Visitor", color: "#3B82F6", isAuto: true, rule: { totalVisits: { gte: 10 } } },
      { name: "At Risk", color: "#9C2A2A", isAuto: true, rule: { daysSinceLastVisit: { gte: 90 } } },
    ].map((t) =>
      prisma.guestTag.create({
        data: {
          tenantId: tenant.id,
          name: t.name,
          color: t.color,
          isAutoTag: t.isAuto,
          rule: t.rule ?? undefined,
        },
      }),
    ),
  );

  // -------------------------------------------------------------------
  // 8. Guests (200)
  // -------------------------------------------------------------------
  console.log("  • generating 200 guests…");
  const guests = await Promise.all(
    Array.from({ length: 200 }).map(async () => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      return prisma.guest.create({
        data: {
          tenantId: tenant.id,
          firstName,
          lastName,
          email: faker.internet.email({ firstName, lastName }).toLowerCase(),
          phone: `+1${faker.string.numeric(10)}`,
          dateOfBirth: faker.date.birthdate({ min: 21, max: 75, mode: "age" }),
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          postalCode: faker.location.zipCode(),
          marketingEmailOptIn: faker.datatype.boolean(0.6),
          marketingSmsOptIn: faker.datatype.boolean(0.3),
          dietaryRestrictions: faker.helpers.arrayElements(
            ["vegetarian", "vegan", "gluten-free", "pescatarian"],
            { min: 0, max: 2 },
          ),
          allergies: faker.helpers.arrayElements(["nuts", "shellfish", "dairy", "eggs"], {
            min: 0,
            max: 2,
          }),
          vipStatus: pickWeighted([
            { value: GuestVipStatus.NONE, weight: 70 },
            { value: GuestVipStatus.REGULAR, weight: 25 },
            { value: GuestVipStatus.VIP, weight: 5 },
          ]),
          source: pickWeighted([
            { value: "online", weight: 60 },
            { value: "walk-in", weight: 25 },
            { value: "import", weight: 15 },
          ]),
        },
      });
    }),
  );
  console.log(`  ✓ guests: ${guests.length}`);

  // -------------------------------------------------------------------
  // 9. Reservations: 300 past + 200 future
  // -------------------------------------------------------------------
  console.log("  • generating 500 reservations…");
  const now = new Date();
  const reservations: { tenantId: string; guestId: string; partySize: number; total: number }[] = [];

  // PAST: 300
  for (let i = 0; i < 300; i++) {
    const guest = faker.helpers.arrayElement(guests);
    const daysAgo = faker.number.int({ min: 1, max: 365 });
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);

    // Skip Mondays
    if (date.getDay() === 1) continue;

    const isLunch = faker.datatype.boolean(0.3);
    const hour = isLunch ? faker.number.int({ min: 11, max: 14 }) : faker.number.int({ min: 17, max: 21 });
    const minute = faker.helpers.arrayElement([0, 15, 30, 45]);

    const startTime = setTime(date, hour, minute);
    const endTime = addMinutes(startTime, 90);
    const partySize = pickWeighted([
      { value: 2, weight: 50 },
      { value: 3, weight: 15 },
      { value: 4, weight: 20 },
      { value: 5, weight: 6 },
      { value: 6, weight: 6 },
      { value: 8, weight: 3 },
    ]);

    const status = pickWeighted<ReservationStatus>([
      { value: ReservationStatus.COMPLETED, weight: 80 },
      { value: ReservationStatus.NO_SHOW, weight: 8 },
      { value: ReservationStatus.CANCELLED, weight: 12 },
    ]);

    const validTables = tables.filter((t) => t.maxCapacity >= partySize && t.minCapacity <= partySize);
    const table = faker.helpers.arrayElement(validTables);

    // Per-guest, per-visit spend used by Phase 5 loyalty engine. Computed once
    // so we can also push it into the guest's totalSpend below.
    const spend =
      status === ReservationStatus.COMPLETED
        ? faker.number.float({ min: 35, max: 220, fractionDigits: 2 }) * partySize
        : null;

    await prisma.reservation.create({
      data: {
        tenantId: tenant.id,
        guestId: guest.id,
        tableId: status === ReservationStatus.CANCELLED ? null : table.id,
        reservationDate: date,
        startTime,
        endTime,
        partySize,
        status,
        source: pickWeighted([
          { value: ReservationSource.ONLINE_WIDGET, weight: 60 },
          { value: ReservationSource.PHONE, weight: 25 },
          { value: ReservationSource.WALK_IN, weight: 10 },
          { value: ReservationSource.GOOGLE_RESERVE, weight: 5 },
        ]),
        guestFirstName: guest.firstName,
        guestLastName: guest.lastName,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        occasion: faker.helpers.maybe(
          () => faker.helpers.arrayElement(["Birthday", "Anniversary", "Date Night", "Business"]),
          { probability: 0.2 },
        ),
        seatedAt: status === ReservationStatus.COMPLETED ? startTime : null,
        completedAt: status === ReservationStatus.COMPLETED ? endTime : null,
        spendAmount: spend,
        spendRecordedAt: spend !== null ? endTime : null,
        noShowAt: status === ReservationStatus.NO_SHOW ? addMinutes(startTime, 20) : null,
        cancelledAt: status === ReservationStatus.CANCELLED ? addMinutes(startTime, -faker.number.int({ min: 60, max: 1440 })) : null,
        createdById: faker.helpers.arrayElement([host.id, owner.id]),
      },
    });

    if (spend !== null) {
      reservations.push({ tenantId: tenant.id, guestId: guest.id, partySize, total: spend });
    }
  }

  // FUTURE: 200
  for (let i = 0; i < 200; i++) {
    const guest = faker.helpers.arrayElement(guests);
    const daysAhead = faker.number.int({ min: 0, max: 60 });
    const date = new Date(now);
    date.setDate(date.getDate() + daysAhead);

    if (date.getDay() === 1) continue; // skip Mondays

    const isLunch = faker.datatype.boolean(0.3);
    const hour = isLunch ? faker.number.int({ min: 11, max: 14 }) : faker.number.int({ min: 17, max: 21 });
    const minute = faker.helpers.arrayElement([0, 15, 30, 45]);
    const startTime = setTime(date, hour, minute);
    const endTime = addMinutes(startTime, 90);
    const partySize = pickWeighted([
      { value: 2, weight: 50 },
      { value: 3, weight: 15 },
      { value: 4, weight: 20 },
      { value: 5, weight: 6 },
      { value: 6, weight: 6 },
      { value: 8, weight: 3 },
    ]);

    const validTables = tables.filter((t) => t.maxCapacity >= partySize && t.minCapacity <= partySize);
    const table = faker.helpers.arrayElement(validTables);

    await prisma.reservation.create({
      data: {
        tenantId: tenant.id,
        guestId: guest.id,
        tableId: table.id,
        reservationDate: date,
        startTime,
        endTime,
        partySize,
        status: pickWeighted<ReservationStatus>([
          { value: ReservationStatus.CONFIRMED, weight: 85 },
          { value: ReservationStatus.PENDING, weight: 15 },
        ]),
        source: pickWeighted([
          { value: ReservationSource.ONLINE_WIDGET, weight: 60 },
          { value: ReservationSource.PHONE, weight: 25 },
          { value: ReservationSource.HOST, weight: 15 },
        ]),
        guestFirstName: guest.firstName,
        guestLastName: guest.lastName,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        occasion: faker.helpers.maybe(
          () => faker.helpers.arrayElement(["Birthday", "Anniversary", "Date Night"]),
          { probability: 0.2 },
        ),
        specialRequests: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.25 }),
        createdById: faker.helpers.arrayElement([host.id, owner.id]),
      },
    });
  }
  console.log(`  ✓ reservations`);

  // -------------------------------------------------------------------
  // 10. Recompute guest metrics from completed reservations
  // -------------------------------------------------------------------
  const aggregated = await prisma.reservation.groupBy({
    by: ["guestId"],
    where: { tenantId: tenant.id, status: ReservationStatus.COMPLETED, guestId: { not: null } },
    _count: { _all: true },
    _min: { startTime: true },
    _max: { startTime: true },
  });

  for (const row of aggregated) {
    if (!row.guestId) continue;
    const guestSpends = reservations.filter((r) => r.guestId === row.guestId);
    const totalSpend = guestSpends.reduce((s, r) => s + r.total, 0);
    const totalVisits = row._count._all;
    await prisma.guest.update({
      where: { id: row.guestId },
      data: {
        totalVisits,
        totalSpend,
        averageSpend: totalVisits ? totalSpend / totalVisits : 0,
        firstVisitAt: row._min.startTime,
        lastVisitAt: row._max.startTime,
      },
    });
  }

  // -------------------------------------------------------------------
  // 11. Tag the top guests
  // -------------------------------------------------------------------
  const vipTag = tags.find((t) => t.name === "VIP")!;
  const bigSpenderTag = tags.find((t) => t.name === "Big Spender")!;
  const frequentTag = tags.find((t) => t.name === "Frequent Visitor")!;

  const topGuests = await prisma.guest.findMany({
    where: { tenantId: tenant.id, totalVisits: { gt: 0 } },
    orderBy: { totalSpend: "desc" },
    take: 30,
  });

  for (const g of topGuests.slice(0, 10)) {
    await prisma.guestTagAssignment.create({ data: { guestId: g.id, tagId: vipTag.id } });
  }
  for (const g of topGuests.filter((g) => g.totalSpend >= 500)) {
    await prisma.guestTagAssignment.create({ data: { guestId: g.id, tagId: bigSpenderTag.id } });
  }
  for (const g of topGuests.filter((g) => g.totalVisits >= 10)) {
    await prisma.guestTagAssignment.create({ data: { guestId: g.id, tagId: frequentTag.id } });
  }

  // -------------------------------------------------------------------
  // 12. Pinned guest notes for top guests
  // -------------------------------------------------------------------
  const noteTemplates = [
    "Allergic to shellfish — flag with kitchen.",
    "Prefers corner table away from kitchen.",
    "Always orders the Barolo — keep a bottle reserved.",
    "Birthday in March — send card.",
    "Travels for business; usually books day-of.",
    "Vegetarian wife, husband eats meat.",
    "Anniversary every August 14.",
    "Dislikes overly sweet desserts.",
  ];
  for (const g of topGuests.slice(0, 15)) {
    await prisma.guestNote.create({
      data: {
        tenantId: tenant.id,
        guestId: g.id,
        authorId: host.id,
        content: faker.helpers.arrayElement(noteTemplates),
        isPinned: faker.datatype.boolean(0.5),
      },
    });
  }

  // -------------------------------------------------------------------
  // 13. Audit log seed entries
  // -------------------------------------------------------------------
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: owner.id,
        action: "tenant.created",
        entityType: "Tenant",
        entityId: tenant.id,
        changes: { after: { name: tenant.name } },
      },
      {
        tenantId: tenant.id,
        userId: owner.id,
        action: "user.invited",
        entityType: "User",
        entityId: users[1]!.id,
        changes: { after: { email: users[1]!.email, role: users[1]!.role } },
      },
    ],
  });

  // -------------------------------------------------------------------
  // 14. Loyalty program — "Friends of Mario"
  // -------------------------------------------------------------------
  const program = await prisma.loyaltyProgram.create({
    data: {
      tenantId: tenant.id,
      name: "Friends of Mario",
      description:
        "Earn 1 point for every dollar spent, plus 50 bonus points each visit. Unlock perks as you climb.",
      isActive: true,
      pointsPerDollar: 1,
      pointsPerVisit: 50,
      redemptionRate: 0.01, // 100 points = $1
    },
  });

  const tiers = await Promise.all([
    prisma.loyaltyTier.create({
      data: {
        programId: program.id,
        name: "Bronze",
        minLifetimePoints: 0,
        multiplier: 1.0,
        perks: ["Welcome dessert on signup"],
        color: "#CD7F32",
        displayOrder: 0,
      },
    }),
    prisma.loyaltyTier.create({
      data: {
        programId: program.id,
        name: "Silver",
        minLifetimePoints: 1500,
        multiplier: 1.25,
        perks: ["Priority weekend seating", "Complimentary amuse-bouche"],
        color: "#C0C0C0",
        displayOrder: 1,
      },
    }),
    prisma.loyaltyTier.create({
      data: {
        programId: program.id,
        name: "Gold",
        minLifetimePoints: 6000,
        multiplier: 1.5,
        perks: ["Reserved table for two", "Chef's tasting on birthdays", "Bottle service discount"],
        color: "#D4AF37",
        displayOrder: 2,
      },
    }),
  ]);

  const [bronze, silver, gold] = tiers;

  // Reward catalogue
  await prisma.reward.createMany({
    data: [
      {
        programId: program.id,
        name: "Complimentary dessert",
        description: "Any dessert on the house for the table.",
        pointsCost: 500,
        isActive: true,
      },
      {
        programId: program.id,
        name: "$20 off the bill",
        description: "Applied to your next dinner.",
        pointsCost: 2000,
        isActive: true,
      },
      {
        programId: program.id,
        name: "Glass of Barolo",
        description: "On the house, one per guest.",
        pointsCost: 800,
        isActive: true,
      },
      {
        programId: program.id,
        name: "Chef's tasting menu (per person)",
        description: "Five-course experience with our chef.",
        pointsCost: 5000,
        isActive: true,
      },
    ],
  });

  // Create accounts + backfill EARN transactions for every guest with at least
  // one completed reservation
  const guestsWithVisits = await prisma.guest.findMany({
    where: { tenantId: tenant.id, totalVisits: { gt: 0 } },
    include: {
      reservations: {
        where: { status: ReservationStatus.COMPLETED, spendAmount: { not: null } },
        select: { id: true, spendAmount: true, completedAt: true },
        orderBy: { completedAt: "asc" },
      },
    },
  });

  for (const g of guestsWithVisits) {
    const account = await prisma.loyaltyAccount.create({
      data: { guestId: g.id, programId: program.id, tierId: bronze!.id },
    });

    let lifetime = 0;
    for (const r of g.reservations) {
      const visitPts = program.pointsPerVisit;
      const spendPts = Math.round((r.spendAmount ?? 0) * program.pointsPerDollar);
      const total = visitPts + spendPts;
      if (total <= 0) continue;
      await prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: "EARN",
          points: total,
          description: `Reservation · $${(r.spendAmount ?? 0).toFixed(0)} spend + visit bonus`,
          reservationId: r.id,
          createdAt: r.completedAt ?? undefined,
        },
      });
      lifetime += total;
    }

    // Burn ~20% of accounts' lifetime points as a "REDEEM" so the demo shows
    // both directions of the ledger
    const burnRatio = faker.datatype.boolean(0.4) ? faker.number.float({ min: 0.05, max: 0.25 }) : 0;
    const burned = Math.round(lifetime * burnRatio);
    if (burned >= 500) {
      await prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: "REDEEM",
          points: -burned,
          description: "Reward redemption",
        },
      });
    }

    // Tier assignment from lifetime points
    const tierForPoints = (lp: number) =>
      lp >= gold!.minLifetimePoints
        ? gold!.id
        : lp >= silver!.minLifetimePoints
        ? silver!.id
        : bronze!.id;

    await prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        lifetimePoints: lifetime,
        currentPoints: lifetime - burned,
        tierId: tierForPoints(lifetime),
      },
    });
  }
  console.log(`  ✓ loyalty: program + ${tiers.length} tiers + 4 rewards + ${guestsWithVisits.length} accounts`);

  // -------------------------------------------------------------------
  // 15. Marketing — templates, segments, one sent campaign
  // -------------------------------------------------------------------
  const bookingConfirmationTpl = await prisma.messageTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Booking confirmation",
      channel: "EMAIL",
      category: "booking_confirmation",
      subject: "Your reservation at {{restaurantName}} is confirmed",
      content:
        "<h1 style=\"font-family:Georgia,serif;font-size:28px;font-weight:500;margin:0 0 16px;\">You're all set, {{firstName}}.</h1>" +
        "<p>We've saved a table for <strong>{{partySize}}</strong> on <strong>{{reservationDate}}</strong> at <strong>{{reservationTime}}</strong>.</p>" +
        "<p style=\"margin:24px 0;padding:16px;background:#FAF8F4;border-radius:6px;font-family:monospace;\">Confirmation: <strong>{{confirmationCode}}</strong></p>" +
        "<p>Call us at <a href=\"tel:{{restaurantPhone}}\" style=\"color:#B5462E;\">{{restaurantPhone}}</a> if you need to change anything.</p>",
      variables: [
        "firstName",
        "partySize",
        "reservationDate",
        "reservationTime",
        "confirmationCode",
        "restaurantName",
        "restaurantPhone",
      ],
      isSystem: true,
    },
  });

  await prisma.messageTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Cancellation notice",
      channel: "EMAIL",
      category: "cancellation",
      subject: "Your reservation at {{restaurantName}} has been cancelled",
      content:
        "<h1 style=\"font-family:Georgia,serif;font-size:28px;font-weight:500;margin:0 0 16px;\">Your reservation is cancelled, {{firstName}}.</h1>" +
        "<p>The booking on <strong>{{reservationDate}}</strong> at <strong>{{reservationTime}}</strong> has been cancelled.</p>" +
        "<p>We'd love to see you another time.</p>",
      variables: ["firstName", "reservationDate", "reservationTime", "restaurantName"],
      isSystem: true,
    },
  });

  const winbackTpl = await prisma.messageTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Winback — we miss you",
      channel: "EMAIL",
      category: "winback",
      subject: "It's been a while, {{firstName}} — come back to {{restaurantName}}",
      content:
        "<h1 style=\"font-family:Georgia,serif;font-size:28px;font-weight:500;margin:0 0 16px;\">We miss you, {{firstName}}.</h1>" +
        "<p>It's been a while since we've seen you at {{restaurantName}}. Your usual table is waiting — book online or call <a href=\"tel:{{restaurantPhone}}\" style=\"color:#B5462E;\">{{restaurantPhone}}</a> and we'll take care of the rest.</p>" +
        "<p>As a member of <strong>{{tierName}}</strong>, you have <strong>{{currentPoints}}</strong> points ready to redeem.</p>",
      variables: ["firstName", "restaurantName", "restaurantPhone", "tierName", "currentPoints"],
    },
  });

  const vipSegment = await prisma.segment.create({
    data: {
      tenantId: tenant.id,
      name: "VIPs & Celebrities",
      description: "Top-tier guests — special treatment for special people.",
      rules: { vipStatus: ["VIP", "CELEBRITY"], marketingEmailOptIn: true },
      isAuto: true,
    },
  });

  const lapsedSegment = await prisma.segment.create({
    data: {
      tenantId: tenant.id,
      name: "Lapsed regulars (60+ days)",
      description: "Guests with 3+ past visits who haven't been back in two months.",
      rules: { minVisits: 3, daysSinceLastVisitMin: 60, marketingEmailOptIn: true },
      isAuto: true,
    },
  });

  // Materialize segment members
  for (const seg of [vipSegment, lapsedSegment]) {
    const rules = seg.rules as Record<string, unknown>;
    const where: Record<string, unknown> = { tenantId: tenant.id };
    if (rules.vipStatus) where.vipStatus = { in: rules.vipStatus };
    if (rules.minVisits != null) where.totalVisits = { gte: rules.minVisits };
    if (rules.daysSinceLastVisitMin != null) {
      where.lastVisitAt = {
        lte: new Date(Date.now() - Number(rules.daysSinceLastVisitMin) * 24 * 60 * 60_000),
      };
    }
    if (rules.marketingEmailOptIn != null) where.marketingEmailOptIn = rules.marketingEmailOptIn;
    const matches = await prisma.guest.findMany({ where, select: { id: true } });
    if (matches.length > 0) {
      await prisma.segmentMember.createMany({
        data: matches.map((g) => ({ segmentId: seg.id, guestId: g.id })),
        skipDuplicates: true,
      });
    }
  }
  const vipCount = await prisma.segmentMember.count({ where: { segmentId: vipSegment.id } });
  const lapsedCount = await prisma.segmentMember.count({ where: { segmentId: lapsedSegment.id } });

  // Make some guests marketing-opted-in so segments aren't empty
  await prisma.guest.updateMany({
    where: { tenantId: tenant.id, totalVisits: { gte: 2 } },
    data: { marketingEmailOptIn: true, marketingOptInAt: new Date() },
  });
  // Re-materialize VIP segment after opt-in update
  await prisma.segmentMember.deleteMany({ where: { segmentId: vipSegment.id } });
  const vipMembers = await prisma.guest.findMany({
    where: {
      tenantId: tenant.id,
      vipStatus: { in: ["VIP", "CELEBRITY"] },
      marketingEmailOptIn: true,
    },
    select: { id: true },
  });
  if (vipMembers.length > 0) {
    await prisma.segmentMember.createMany({
      data: vipMembers.map((g) => ({ segmentId: vipSegment.id, guestId: g.id })),
      skipDuplicates: true,
    });
  }

  // One previously-sent winback campaign to make the dashboard feel alive
  const sampleCampaign = await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      segmentId: lapsedSegment.id,
      templateId: winbackTpl.id,
      createdById: owner.id,
      name: "Winback — last month's lapsed regulars",
      channel: "EMAIL",
      status: "SENT",
      subject: winbackTpl.subject,
      content: winbackTpl.content,
      sentAt: new Date(Date.now() - 14 * 24 * 60 * 60_000),
      recipientCount: lapsedCount,
      sentCount: Math.max(0, lapsedCount - Math.floor(lapsedCount * 0.05)),
      deliveredCount: Math.max(0, lapsedCount - Math.floor(lapsedCount * 0.08)),
      openedCount: Math.floor(lapsedCount * 0.42),
      clickedCount: Math.floor(lapsedCount * 0.11),
      bouncedCount: Math.floor(lapsedCount * 0.05),
    },
  });

  // Spread synthetic recipient rows so the campaign detail page has content.
  // We just record a handful representative rows rather than every member.
  const lapsedMembers = await prisma.segmentMember.findMany({
    where: { segmentId: lapsedSegment.id },
    take: 20,
  });
  for (const m of lapsedMembers) {
    const r = Math.random();
    const status = r < 0.1 ? "BOUNCED" : r < 0.25 ? "OPENED" : r < 0.4 ? "CLICKED" : "DELIVERED";
    await prisma.campaignRecipient.create({
      data: {
        campaignId: sampleCampaign.id,
        guestId: m.guestId,
        status,
        sentAt: new Date(Date.now() - 14 * 24 * 60 * 60_000),
        deliveredAt: status !== "BOUNCED" ? new Date(Date.now() - 14 * 24 * 60 * 60_000) : null,
        openedAt:
          status === "OPENED" || status === "CLICKED"
            ? new Date(Date.now() - 13 * 24 * 60 * 60_000)
            : null,
        clickedAt: status === "CLICKED" ? new Date(Date.now() - 13 * 24 * 60 * 60_000) : null,
      },
    });
  }

  console.log(`  ✓ marketing: 3 templates + 2 segments (${vipMembers.length}, ${lapsedCount}) + 1 past campaign`);

  console.log("\n✅  Seed complete\n");
  console.log("    URL:       http://localhost:3000");
  console.log("    Login:     owner@mariosbistro.com / password123");
  console.log("    Other accounts:");
  console.log("      admin@mariosbistro.com  / password123");
  console.log("      manager@mariosbistro.com / password123");
  console.log("      host@mariosbistro.com   / password123");
  console.log("      staff@mariosbistro.com  / password123\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
