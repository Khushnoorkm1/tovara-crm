import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, ArrowRight, Building2, Users, Settings as SettingsIcon } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "tenant.view")) redirect("/dashboard");

  const canManageIntegrations = hasPermission(ctx.role, "integration.manage");

  return (
    <div className="mx-auto max-w-[900px] animate-fade-in space-y-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Configure
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Restaurant-wide configuration. More panels arrive in Phase 9.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {canManageIntegrations ? (
          <Card
            href="/settings/integrations"
            icon={<CreditCard className="h-5 w-5" />}
            title="Integrations"
            description="Stripe deposits, API keys, webhooks"
            active
          />
        ) : null}
        <Card
          href="/settings/hours"
          icon={<Building2 className="h-5 w-5" />}
          title="Operating hours"
          description="Open/close times, lunch and dinner shifts"
          active
        />
        <Card
          href="/settings/team"
          icon={<Users className="h-5 w-5" />}
          title="Team & roles"
          description="Manage staff access and permissions"
          active
        />
        <Card
          href="/settings/rules"
          icon={<SettingsIcon className="h-5 w-5" />}
          title="Reservation rules"
          description="Lead times, slot length, party limits, reminders"
          active
        />
      </div>
    </div>
  );
}

function Card({
  href,
  icon,
  title,
  description,
  active,
  comingSoon,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  active?: boolean;
  comingSoon?: boolean;
}) {
  const inner = (
    <div
      className={`group flex items-start gap-4 rounded-lg border p-5 transition ${
        active
          ? "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
          : "border-dashed border-border bg-card/50"
      }`}
    >
      <span
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md ${
          active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {title}
          {comingSoon ? (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              soon
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {active ? (
        <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
