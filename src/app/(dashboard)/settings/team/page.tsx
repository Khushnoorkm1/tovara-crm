import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { TeamPanel } from "@/components/settings/team-panel";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "user.view")) redirect("/dashboard");

  const users = await ctx.db.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-[900px] animate-fade-in space-y-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Configure
        </p>
        <h1 className="mt-3 flex items-center gap-3 text-4xl tracking-tight">
          Team
          <Users className="h-7 w-7 text-primary/60" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Who can access the dashboard and what they can do. Invite flow arrives in the next
          minor release — for now, run <code className="font-mono text-xs">pnpm db:seed</code> to
          add a fixture user.
        </p>
      </div>

      <TeamPanel
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={ctx.userId}
        currentRole={ctx.role}
      />
    </div>
  );
}
