import Link from "next/link";
import { Phone, Mail, StickyNote } from "lucide-react";
import { formatCurrency, formatRelative, initials } from "@/lib/format";
import { VipBadge } from "./vip-badge";
import type { GuestListItem } from "@/server/services/guest.service";

export function GuestRow({ guest }: { guest: GuestListItem }) {
  const name = `${guest.firstName} ${guest.lastName ?? ""}`.trim();

  return (
    <tr className="border-b border-border last:border-b-0 transition hover:bg-secondary/30">
      {/* Name + avatar */}
      <td className="px-4 py-3 align-top">
        <Link href={`/guests/${guest.id}`} className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="truncate">{name}</span>
              <VipBadge status={guest.vipStatus} />
            </p>
            {guest._count.notes > 0 ? (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <StickyNote className="h-2.5 w-2.5" />
                {guest._count.notes} {guest._count.notes === 1 ? "note" : "notes"}
              </p>
            ) : null}
          </div>
        </Link>
      </td>

      {/* Contact */}
      <td className="px-4 py-3 align-top">
        <div className="space-y-0.5">
          {guest.phone ? (
            <a
              href={`tel:${guest.phone}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Phone className="h-3 w-3" />
              {guest.phone}
            </a>
          ) : null}
          {guest.email ? (
            <a
              href={`mailto:${guest.email}`}
              className="flex items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-3 w-3" />
              <span className="truncate">{guest.email}</span>
            </a>
          ) : null}
          {!guest.phone && !guest.email ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : null}
        </div>
      </td>

      {/* Visits */}
      <td className="px-4 py-3 text-right align-top">
        <p className="font-mono text-sm tabular-nums">{guest.totalVisits}</p>
        {guest.totalNoShows > 0 ? (
          <p className="font-mono text-[10px] text-destructive">
            {guest.totalNoShows} no-show{guest.totalNoShows === 1 ? "" : "s"}
          </p>
        ) : null}
      </td>

      {/* Spend */}
      <td className="px-4 py-3 text-right align-top">
        <p className="font-mono text-sm tabular-nums">
          {guest.totalSpend > 0 ? formatCurrency(guest.totalSpend) : "—"}
        </p>
        {guest.averageSpend > 0 ? (
          <p className="font-mono text-[10px] text-muted-foreground">
            {formatCurrency(guest.averageSpend)} avg
          </p>
        ) : null}
      </td>

      {/* Last visit */}
      <td className="px-4 py-3 text-right align-top">
        <p className="text-xs">
          {guest.lastVisitAt ? formatRelative(guest.lastVisitAt) : "—"}
        </p>
      </td>

      {/* Tags */}
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {guest.tags.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: t.tag.color ?? "#3B82F6" }}
              />
              {t.tag.name}
            </span>
          ))}
          {guest.tags.length > 3 ? (
            <span className="font-mono text-[9px] text-muted-foreground">
              +{guest.tags.length - 3}
            </span>
          ) : null}
        </div>
      </td>

      {/* Action */}
      <td className="px-4 py-3 text-right align-top">
        <Link
          href={`/guests/${guest.id}`}
          className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          View →
        </Link>
      </td>
    </tr>
  );
}
