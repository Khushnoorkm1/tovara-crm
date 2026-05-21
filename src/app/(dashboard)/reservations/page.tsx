import Link from "next/link";
import { Plus, Calendar, Search } from "lucide-react";
import { ReservationStatus } from "@prisma/client";
import { requireAuthOrRedirect } from "@/server/tenant";
import { listReservations } from "@/server/services/reservation.service";
import { DateStrip } from "@/components/reservations/date-strip";
import { StatusFilter } from "@/components/reservations/status-filter";
import { ReservationRow } from "@/components/reservations/reservation-row";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Reservations" };
export const dynamic = "force-dynamic";

const STATUS_FROM_PARAM: Record<string, ReservationStatus[]> = {
  pending: [ReservationStatus.PENDING],
  confirmed: [ReservationStatus.CONFIRMED],
  seated: [ReservationStatus.SEATED],
  completed: [ReservationStatus.COMPLETED],
  no_show: [ReservationStatus.NO_SHOW],
  cancelled: [ReservationStatus.CANCELLED],
};

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; q?: string }>;
}) {
  const ctx = await requireAuthOrRedirect();
  const sp = await searchParams;

  const date = sp.date ?? formatLocalDate(new Date());
  const status = sp.status ? STATUS_FROM_PARAM[sp.status] : undefined;
  const search = sp.q;

  const { items, total } = await listReservations({ ctx, date, status, search });

  const lunch = items.filter((r) => r.startTime.getHours() < 16);
  const dinner = items.filter((r) => r.startTime.getHours() >= 16);

  const dateObj = parseLocalDate(date);
  const isToday = isSameDay(dateObj, new Date());

  return (
    <div className="mx-auto max-w-[1200px] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Service
          </p>
          <h1 className="mt-3 text-4xl tracking-tight">
            {isToday ? "Today's reservations" : formatDate(dateObj, "EEEE, MMM d")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {total === 0 ? "No reservations" : `${total} ${total === 1 ? "reservation" : "reservations"}`}
            {search ? <> matching <em>"{search}"</em></> : null}
          </p>
        </div>

        <Link
          href={`/reservations/new?date=${date}`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New reservation
        </Link>
      </div>

      {/* Date strip */}
      <div className="mt-8">
        <DateStrip selected={date} />
      </div>

      {/* Filters + search */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusFilter />
        <SearchBox initialValue={search ?? ""} />
      </div>

      {/* List */}
      {items.length === 0 ? (
        <EmptyState date={date} hasFilters={!!status || !!search} />
      ) : (
        <div className="mt-8 space-y-8">
          {lunch.length > 0 ? <ShiftSection label="Lunch" items={lunch} /> : null}
          {dinner.length > 0 ? <ShiftSection label="Dinner" items={dinner} /> : null}
        </div>
      )}
    </div>
  );
}

function ShiftSection({
  label,
  items,
}: {
  label: string;
  items: Awaited<ReturnType<typeof listReservations>>["items"];
}) {
  const totalCovers = items.reduce((s, r) => s + r.partySize, 0);
  return (
    <section>
      <header className="flex items-baseline justify-between border-b border-border pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {items.length} {items.length === 1 ? "booking" : "bookings"} · {totalCovers} covers
        </p>
      </header>
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {items.map((r) => (
          <ReservationRow key={r.id} reservation={r} />
        ))}
      </ul>
    </section>
  );
}

function EmptyState({ date, hasFilters }: { date: string; hasFilters: boolean }) {
  return (
    <div className="mt-12 rounded-lg border border-dashed border-border p-16 text-center">
      <Calendar className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="mt-4 text-sm font-medium">
        {hasFilters ? "No reservations match these filters." : "No reservations on this day."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasFilters ? "Try clearing the filters." : "Create one to fill the floor."}
      </p>
      <Link
        href={`/reservations/new?date=${date}`}
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-3.5 w-3.5" />
        New reservation
      </Link>
    </div>
  );
}

function SearchBox({ initialValue }: { initialValue: string }) {
  return (
    <form action="" className="flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 lg:w-72">
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        type="text"
        name="q"
        defaultValue={initialValue}
        placeholder="Search guest, code, phone…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
