import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Download, Users, Search } from "lucide-react";
import { GuestVipStatus } from "@prisma/client";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { listGuests, getTagCounts } from "@/server/services/guest.service";
import { GuestFilters } from "@/components/guests/guest-filters";
import { GuestRow } from "@/components/guests/guest-row";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Guests" };
export const dynamic = "force-dynamic";

const VIP_FROM_PARAM: Record<string, GuestVipStatus[]> = {
  vip: [GuestVipStatus.VIP, GuestVipStatus.CELEBRITY],
  regular: [GuestVipStatus.REGULAR],
};

const SORT_OPTIONS = ["name", "lastVisit", "totalSpend", "totalVisits"] as const;
type SortBy = (typeof SORT_OPTIONS)[number];

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    vip?: string;
    tag?: string;
    sort?: SortBy;
    page?: string;
  }>;
}) {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "guest.view")) redirect("/dashboard");

  const sp = await searchParams;
  const search = sp.q?.trim() || undefined;
  const vipStatus = sp.vip ? VIP_FROM_PARAM[sp.vip] : undefined;
  const tagIds = sp.tag ? sp.tag.split(",").filter(Boolean) : undefined;
  const sortBy: SortBy =
    sp.sort && SORT_OPTIONS.includes(sp.sort as SortBy) ? (sp.sort as SortBy) : "name";
  const page = Math.max(1, Number(sp.page ?? 1));

  const [guestsResult, tags] = await Promise.all([
    listGuests({ ctx, search, vipStatus, tagIds, sortBy, page, pageSize: 50 }),
    getTagCounts(ctx),
  ]);

  const totalSpend = guestsResult.items.reduce((s, g) => s + g.totalSpend, 0);

  return (
    <div className="mx-auto max-w-[1300px] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Relationships
          </p>
          <h1 className="mt-3 text-4xl tracking-tight">Guests</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {guestsResult.total.toLocaleString()}{" "}
            {guestsResult.total === 1 ? "guest" : "guests"}
            {search ? <> matching <em>"{search}"</em></> : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission(ctx.role, "guest.export") ? (
            <a
              href="/api/guests/export"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          ) : null}
          {hasPermission(ctx.role, "guest.create") ? (
            <Link
              href="/guests/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New guest
            </Link>
          ) : null}
        </div>
      </div>

      {/* Search + filters */}
      <div className="mt-8 space-y-3">
        <SearchBox initialValue={search ?? ""} />
        <GuestFilters tags={tags} />
      </div>

      {/* Table */}
      {guestsResult.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <SortableHeader label="Name" param="name" current={sortBy} />
                  <Th>Contact</Th>
                  <SortableHeader label="Visits" param="totalVisits" current={sortBy} align="right" />
                  <SortableHeader label="Spend" param="totalSpend" current={sortBy} align="right" />
                  <SortableHeader label="Last visit" param="lastVisit" current={sortBy} align="right" />
                  <Th>Tags</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {guestsResult.items.map((g) => (
                  <GuestRow key={g.id} guest={g} />
                ))}
              </tbody>
            </table>
          </div>

          {guestsResult.totalPages > 1 ? (
            <Pagination page={page} totalPages={guestsResult.totalPages} />
          ) : (
            <p className="mt-4 text-right text-xs text-muted-foreground">
              Showing all {guestsResult.total} · Total spend on this page:{" "}
              <span className="font-mono">{formatCurrency(totalSpend)}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </th>
  );
}

function SortableHeader({
  label,
  param,
  current,
  align = "left",
}: {
  label: string;
  param: SortBy;
  current: SortBy;
  align?: "left" | "right";
}) {
  const active = current === param;
  return (
    <th
      className={`px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] ${align === "right" ? "text-right" : "text-left"}`}
    >
      <Link
        href={`?sort=${param}`}
        className={active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
      >
        {label} {active ? "↓" : ""}
      </Link>
    </th>
  );
}

function SearchBox({ initialValue }: { initialValue: string }) {
  return (
    <form action="" className="flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 lg:max-w-md">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        name="q"
        defaultValue={initialValue}
        placeholder="Search by name, email, or phone…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {initialValue ? (
        <Link
          href="?"
          className="rounded px-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 rounded-lg border border-dashed border-border p-16 text-center">
      <Users className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="mt-4 text-sm font-medium">No guests match these filters.</p>
      <p className="mt-1 text-xs text-muted-foreground">Try clearing them, or add a guest.</p>
    </div>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <nav className="mt-6 flex items-center justify-between">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={`?page=${page - 1}`}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            ← Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={`?page=${page + 1}`}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Next →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
