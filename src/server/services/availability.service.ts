import type { TenantDb } from "@/server/db";
import { ReservationStatus, type DayOfWeek } from "@prisma/client";

/**
 * One time slot returned to the client.
 */
export type AvailabilitySlot = {
  /** "HH:mm" in tenant local time */
  time: string;
  /** Tables that can still seat this party at this slot. */
  candidateTableIds: string[];
};

const DAY_OF_WEEK: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

/**
 * Parse "HH:mm" into total minutes since midnight.
 */
function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h! * 60 + m!;
}

/**
 * Return a Date in tenant local time at the given Y-M-D and minutes-of-day.
 *
 * For Phase 2 we treat tenant timezone as the server's local zone — all our
 * displayed times are derived from `startTime` (UTC) but we anchor them to
 * the calendar date in the client. A future enhancement is to honour
 * `Tenant.timezone` strictly with date-fns-tz; for now this works for a
 * single-region MVP and matches how the seed wrote times.
 */
function dateAtMinutes(dateStr: string, minutes: number): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const out = new Date(y!, (mo! - 1), d!, 0, 0, 0, 0);
  out.setMinutes(minutes);
  return out;
}

export interface GetAvailabilityParams {
  /** Tenant-scoped Prisma client. Auth callers pass `ctx.db`; public callers pass `tenantDb(tenantId)`. */
  db: TenantDb;
  date: string; // YYYY-MM-DD
  partySize: number;
}

export interface GetAvailabilityResult {
  date: string;
  partySize: number;
  slots: AvailabilitySlot[];
  closed: boolean;
  closureReason?: string;
}

/**
 * Compute available slots for a date & party size.
 *
 * Algorithm:
 *   1. Pull reservation settings (slot interval, default dining duration, lead time).
 *   2. Look up operating hours for the day-of-week, and any SpecialClosure.
 *   3. Pull tables that can seat this party (minCapacity ≤ size ≤ maxCapacity, isActive).
 *   4. Pull existing reservations for the day + tables (only blocking statuses).
 *   5. For each shift: walk the day in slot-sized increments. At each slot, a
 *      table is "available" iff no reservation overlaps [slot, slot+duration].
 *   6. Slot included if at least one table is available.
 */
export async function getAvailability(
  params: GetAvailabilityParams,
): Promise<GetAvailabilityResult> {
  const { db, date, partySize } = params;

  // ---- 1. Settings ----
  const settings =
    (await db.reservationSettings.findFirst({})) ??
    {
      slotDurationMinutes: 15,
      defaultDiningDurationMin: 90,
      minLeadTimeMinutes: 30,
      advanceBookingDays: 60,
      maxPartySize: 12,
    };

  if (partySize > settings.maxPartySize) {
    return { date, partySize, slots: [], closed: false };
  }

  // ---- 2. Hours / closures ----
  const target = new Date(`${date}T00:00:00`);
  const dow = DAY_OF_WEEK[target.getDay()]!;

  const [hours, closure] = await Promise.all([
    db.operatingHours.findMany({ where: { dayOfWeek: dow, isClosed: false } }),
    db.specialClosure.findFirst({ where: { date: target } }),
  ]);

  if (closure?.isClosedAllDay) {
    return { date, partySize, slots: [], closed: true, closureReason: closure.reason ?? "Closed" };
  }
  if (hours.length === 0) {
    return { date, partySize, slots: [], closed: true, closureReason: "Closed" };
  }

  // Apply special-closure custom hours if present (e.g. "open late on NYE")
  const shifts = closure?.customOpenTime && closure?.customCloseTime
    ? [{ openTime: closure.customOpenTime, closeTime: closure.customCloseTime }]
    : hours;

  // ---- 3. Eligible tables ----
  const tables = await db.table.findMany({
    where: {
      isActive: true,
      minCapacity: { lte: partySize },
      maxCapacity: { gte: partySize },
    },
    select: { id: true, minCapacity: true, maxCapacity: true },
  });

  if (tables.length === 0) {
    return { date, partySize, slots: [], closed: false };
  }

  // ---- 4. Existing reservations on those tables for this day ----
  const dayStart = dateAtMinutes(date, 0);
  const dayEnd = dateAtMinutes(date, 24 * 60);
  const existing = await db.reservation.findMany({
    where: {
      tableId: { in: tables.map((t) => t.id) },
      startTime: { gte: dayStart, lt: dayEnd },
      status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED] },
    },
    select: { tableId: true, startTime: true, endTime: true },
  });

  // Group by tableId for O(1) overlap checks
  const bookingsByTable = new Map<string, { start: number; end: number }[]>();
  for (const r of existing) {
    if (!r.tableId) continue;
    const arr = bookingsByTable.get(r.tableId) ?? [];
    arr.push({ start: r.startTime.getTime(), end: r.endTime.getTime() });
    bookingsByTable.set(r.tableId, arr);
  }

  // ---- 5. Walk slots in each shift ----
  const slotMin = settings.slotDurationMinutes;
  const dineMin = settings.defaultDiningDurationMin;
  const leadMin = settings.minLeadTimeMinutes;
  const earliest = Date.now() + leadMin * 60_000;

  // Prefer smaller tables first (don't waste a 6-top on a 2-top)
  const sortedTables = [...tables].sort((a, b) => a.maxCapacity - b.maxCapacity);

  const slots: AvailabilitySlot[] = [];
  const seenTimes = new Set<string>(); // dedupe across overlapping shifts

  for (const shift of shifts) {
    const openMin = parseHm(shift.openTime);
    const closeMin = parseHm(shift.closeTime);
    // Last bookable slot leaves room for one full dining window
    const lastSlotMin = closeMin - dineMin;

    for (let m = openMin; m <= lastSlotMin; m += slotMin) {
      const slotStart = dateAtMinutes(date, m);
      if (slotStart.getTime() < earliest) continue;
      const slotEnd = new Date(slotStart.getTime() + dineMin * 60_000);

      const candidates: string[] = [];
      for (const t of sortedTables) {
        const bookings = bookingsByTable.get(t.id) ?? [];
        const overlaps = bookings.some(
          (b) => b.start < slotEnd.getTime() && b.end > slotStart.getTime(),
        );
        if (!overlaps) candidates.push(t.id);
      }

      if (candidates.length === 0) continue;
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const key = `${hh}:${mm}`;
      if (seenTimes.has(key)) continue;
      seenTimes.add(key);

      slots.push({ time: key, candidateTableIds: candidates });
    }
  }

  return { date, partySize, slots, closed: false };
}

/**
 * Pick the smallest table from the candidate list. Used by createReservation
 * when the host doesn't specify one explicitly.
 */
export function pickBestTable(candidateTableIds: string[]): string | null {
  // The list comes pre-sorted (smallest first) from getAvailability.
  return candidateTableIds[0] ?? null;
}
