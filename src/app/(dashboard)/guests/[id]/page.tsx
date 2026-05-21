import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Wallet,
  CalendarCheck,
  Ban,
  Pencil,
  Cake,
  Utensils,
  Bell,
} from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { getGuestById } from "@/server/services/guest.service";
import { listTags } from "@/server/services/guest-tag.service";
import {
  getAccountForGuest,
  getOrCreateProgram,
} from "@/server/services/loyalty.service";
import { formatCurrency, formatDate, formatRelative, initials } from "@/lib/format";
import { VipBadge } from "@/components/guests/vip-badge";
import { GuestNotesPanel } from "@/components/guests/guest-notes-panel";
import { GuestTagsPanel } from "@/components/guests/guest-tags-panel";
import { GuestReservations } from "@/components/guests/guest-reservations";
import { GuestLoyaltyCard } from "@/components/loyalty/guest-loyalty-card";

export const metadata = { title: "Guest" };
export const dynamic = "force-dynamic";

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "guest.view")) redirect("/dashboard");

  const { id } = await params;
  const [guest, allTags, account, program] = await Promise.all([
    getGuestById(ctx, id),
    listTags(ctx),
    getAccountForGuest(ctx, id),
    getOrCreateProgram(ctx),
  ]);
  if (!guest) notFound();

  const name = `${guest.firstName} ${guest.lastName ?? ""}`.trim();
  const upcomingRes = guest.reservations.filter(
    (r) => r.startTime > new Date() && r.status !== "CANCELLED" && r.status !== "NO_SHOW",
  );
  const pastRes = guest.reservations.filter(
    (r) => r.startTime <= new Date() || r.status === "CANCELLED" || r.status === "NO_SHOW",
  );

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <Link
        href="/guests"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to guests
      </Link>

      {/* Hero */}
      <header className="mt-6 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-5">
          <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-base text-primary">
            {initials(name)}
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Guest profile
            </p>
            <h1 className="mt-2 flex items-center gap-3 font-display text-4xl tracking-tight">
              {name}
              <VipBadge status={guest.vipStatus} />
            </h1>
            <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              {guest.phone ? (
                <a href={`tel:${guest.phone}`} className="flex items-center gap-1 hover:text-foreground">
                  <Phone className="h-3 w-3" /> {guest.phone}
                </a>
              ) : null}
              {guest.email ? (
                <a href={`mailto:${guest.email}`} className="flex items-center gap-1 hover:text-foreground">
                  <Mail className="h-3 w-3" /> {guest.email}
                </a>
              ) : null}
            </p>
          </div>
        </div>

        {hasPermission(ctx.role, "guest.update") ? (
          <Link
            href={`/guests/${guest.id}/edit`}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium transition hover:bg-secondary"
          >
            <Pencil className="h-3 w-3" />
            Edit profile
          </Link>
        ) : null}
      </header>

      {/* Stat strip */}
      <section className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5">
        <Stat
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Total visits"
          value={guest.totalVisits.toString()}
        />
        <Stat
          icon={<Wallet className="h-4 w-4" />}
          label="Lifetime spend"
          value={formatCurrency(guest.totalSpend)}
        />
        <Stat
          icon={<Wallet className="h-4 w-4" />}
          label="Avg spend"
          value={formatCurrency(guest.averageSpend)}
        />
        <Stat
          icon={<Ban className="h-4 w-4" />}
          label="No-shows"
          value={guest.totalNoShows.toString()}
          tone={guest.totalNoShows > 0 ? "warning" : "default"}
        />
        <Stat
          icon={<Calendar className="h-4 w-4" />}
          label="Last visit"
          value={guest.lastVisitAt ? formatRelative(guest.lastVisitAt) : "Never"}
        />
      </section>

      {/* Tags */}
      <section className="mt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Tags
        </p>
        <div className="mt-3">
          <GuestTagsPanel
            guestId={guest.id}
            assignedTags={guest.tags.map((a) => ({
              id: a.tag.id,
              name: a.tag.name,
              color: a.tag.color,
              isAutoTag: a.tag.isAutoTag,
            }))}
            allTags={allTags.map((t) => ({
              id: t.id,
              name: t.name,
              color: t.color,
              isAutoTag: t.isAutoTag,
            }))}
            canManage={hasPermission(ctx.role, "guest.tag.manage")}
          />
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Main column */}
        <div className="space-y-10">
          {/* Notes */}
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Notes
            </p>
            <div className="mt-3">
              <GuestNotesPanel
                guestId={guest.id}
                notes={guest.notes.map((n) => ({
                  id: n.id,
                  content: n.content,
                  isPinned: n.isPinned,
                  createdAt: n.createdAt.toISOString(),
                  updatedAt: n.updatedAt.toISOString(),
                  authorName: n.author?.name ?? n.author?.email ?? null,
                  authorId: n.authorId,
                }))}
                currentUserId={ctx.userId}
                canEditAny={
                  ctx.role === "OWNER" || ctx.role === "ADMIN" || ctx.role === "MANAGER"
                }
                canCreate={hasPermission(ctx.role, "guest.note.create")}
              />
            </div>
          </section>

          {/* Reservations */}
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Reservation history
            </p>
            <div className="mt-3">
              <GuestReservations
                upcoming={upcomingRes.map(toReservationDto)}
                past={pastRes.map(toReservationDto)}
              />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Loyalty card — Phase 5 */}
          {program.tiers.length > 0 ? (
            <GuestLoyaltyCard
              guestId={guest.id}
              programName={program.name}
              isActive={program.isActive}
              currentPoints={account?.currentPoints ?? 0}
              lifetimePoints={account?.lifetimePoints ?? 0}
              tier={
                account?.tier
                  ? {
                      id: account.tier.id,
                      name: account.tier.name,
                      minLifetimePoints: account.tier.minLifetimePoints,
                      multiplier: account.tier.multiplier,
                      color: account.tier.color,
                      perks: account.tier.perks,
                    }
                  : null
              }
              nextTier={(() => {
                const sorted = [...program.tiers].sort(
                  (a, b) => a.minLifetimePoints - b.minLifetimePoints,
                );
                const lp = account?.lifetimePoints ?? 0;
                const next = sorted.find((t) => t.minLifetimePoints > lp);
                return next
                  ? {
                      id: next.id,
                      name: next.name,
                      minLifetimePoints: next.minLifetimePoints,
                      multiplier: next.multiplier,
                      color: next.color,
                      perks: next.perks,
                    }
                  : null;
              })()}
              rewards={program.rewards.map((r) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                pointsCost: r.pointsCost,
                isActive: r.isActive,
              }))}
              recentTransactions={(account?.transactions ?? []).map((t) => ({
                id: t.id,
                type: t.type,
                points: t.points,
                description: t.description,
                createdAt: t.createdAt.toISOString(),
              }))}
              canManage={hasPermission(ctx.role, "loyalty.manage")}
            />
          ) : null}

          {/* Profile details */}
          <Card title="Profile">
            <DetailRow icon={<Cake className="h-3.5 w-3.5" />} label="Birthday">
              {guest.dateOfBirth ? formatDate(guest.dateOfBirth, "MMM d") : "—"}
            </DetailRow>
            <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
              {[guest.city, guest.state].filter(Boolean).join(", ") || "—"}
            </DetailRow>
            <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="First visit">
              {guest.firstVisitAt ? formatDate(guest.firstVisitAt) : "—"}
            </DetailRow>
            <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Member since">
              {formatDate(guest.createdAt)}
            </DetailRow>
            <DetailRow label="Source">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {guest.source ?? "—"}
              </span>
            </DetailRow>
          </Card>

          {/* Preferences */}
          {(guest.dietaryRestrictions.length ||
            guest.allergies.length ||
            guest.favoriteSeating) ? (
            <Card title="Preferences">
              {guest.allergies.length ? (
                <DetailRow icon={<Ban className="h-3.5 w-3.5 text-destructive" />} label="Allergies">
                  <span className="text-destructive">{guest.allergies.join(", ")}</span>
                </DetailRow>
              ) : null}
              {guest.dietaryRestrictions.length ? (
                <DetailRow icon={<Utensils className="h-3.5 w-3.5" />} label="Dietary">
                  {guest.dietaryRestrictions.join(", ")}
                </DetailRow>
              ) : null}
              {guest.favoriteSeating ? (
                <DetailRow label="Favorite seating">{guest.favoriteSeating}</DetailRow>
              ) : null}
            </Card>
          ) : null}

          {/* Marketing */}
          <Card title="Marketing">
            <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email">
              {guest.marketingEmailOptIn ? (
                <span className="text-success">Opted in</span>
              ) : (
                <span className="text-muted-foreground">Opted out</span>
              )}
            </DetailRow>
            <DetailRow icon={<Bell className="h-3.5 w-3.5" />} label="SMS">
              {guest.marketingSmsOptIn ? (
                <span className="text-success">Opted in</span>
              ) : (
                <span className="text-muted-foreground">Opted out</span>
              )}
            </DetailRow>
            {guest.marketingOptInAt ? (
              <p className="mt-2 border-t border-border pt-2 font-mono text-[10px] text-muted-foreground">
                Last opt-in {formatDate(guest.marketingOptInAt)}
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------

function toReservationDto(r: {
  id: string;
  startTime: Date;
  endTime: Date;
  partySize: number;
  status: string;
  occasion: string | null;
  table: { name: string } | null;
}) {
  return {
    id: r.id,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    partySize: r.partySize,
    status: r.status as "PENDING" | "CONFIRMED" | "SEATED" | "COMPLETED" | "NO_SHOW" | "CANCELLED",
    occasion: r.occasion,
    tableName: r.table?.name ?? null,
  };
}

function Stat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className={`mt-2 font-display text-2xl tabular-nums ${tone === "warning" ? "text-warning" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-3 space-y-2.5">{children}</div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {icon ? <span className="mt-0.5 text-muted-foreground">{icon}</span> : <span className="w-3.5" />}
      <div className="flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}
