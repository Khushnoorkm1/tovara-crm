"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  LayoutGrid,
  Users,
  Heart,
  Megaphone,
  BarChart3,
  Settings,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, type Permission } from "@/server/rbac";
import { UserRole } from "@prisma/client";
import { APP_NAME } from "@/lib/constants";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  comingSoon?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Service",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reservations", label: "Reservations", icon: CalendarDays, permission: "reservation.view" },
      { href: "/floor", label: "Floor plan", icon: LayoutGrid, permission: "table.view" },
      { href: "/waitlist", label: "Waitlist", icon: Clock, permission: "waitlist.manage" },
    ],
  },
  {
    label: "Relationships",
    items: [
      { href: "/guests", label: "Guests", icon: Users, permission: "guest.view" },
      { href: "/loyalty", label: "Loyalty", icon: Heart, permission: "loyalty.view" },
      { href: "/marketing", label: "Marketing", icon: Megaphone, permission: "marketing.view" },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics.view" },
      { href: "/audit-log", label: "Audit log", icon: ScrollText, permission: "audit.view" },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, permission: "tenant.view" },
    ],
  },
];

export function Sidebar({
  tenant,
  role,
}: {
  tenant: { name: string; slug: string };
  role: UserRole;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/50 lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <BrandMark className="text-primary" />
        <div className="flex flex-col leading-none">
          <span className="font-display text-base tracking-tight">{APP_NAME}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {tenant.name}
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter(
            (i) => !i.permission || hasPermission(role, i.permission),
          );
          if (visible.length === 0) return null;
          return (
            <div key={group.label} className="mb-6">
              <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => (
                  <NavItem key={item.href} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border px-6 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Plan
        </p>
        <p className="mt-1 text-sm">Professional</p>
      </div>
    </aside>
  );
}

function NavItem({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, icon: Icon, comingSoon } = item;
  const inner = (
    <span
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        comingSoon && "cursor-default opacity-60 hover:bg-transparent",
      )}
      aria-disabled={comingSoon}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {comingSoon ? (
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Soon
        </span>
      ) : null}
    </span>
  );

  if (comingSoon) return <li>{inner}</li>;

  return (
    <li>
      <Link href={href}>{inner}</Link>
    </li>
  );
}

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 16h12M16 10v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
