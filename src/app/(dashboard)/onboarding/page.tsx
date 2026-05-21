import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";

export const metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await requireAuthOrRedirect();
  if (ctx.role !== "OWNER") redirect("/dashboard");

  // Detect what's set up. Each row is "done" if the relevant entity exists.
  const [tenant, hoursCount, tablesCount, settings, tagCount, _hasGuests, subscription] =
    await Promise.all([
      ctx.db.tenant.findFirst({}),
      ctx.db.operatingHours.count(),
      ctx.db.table.count(),
      ctx.db.reservationSettings.findUnique({ where: { tenantId: ctx.tenantId } }),
      ctx.db.guestTag.count(),
      ctx.db.guest.findFirst({ select: { id: true } }),
      ctx.db.tenantSubscription.findUnique({ where: { tenantId: ctx.tenantId } }),
    ]);

  const steps = [
    {
      key: "profile",
      title: "Restaurant profile",
      description: "Name, address, brand color",
      done: !!tenant?.name,
      href: "/settings",
    },
    {
      key: "hours",
      title: "Operating hours",
      description: "When you're open for business",
      done: hoursCount > 0,
      href: "/settings/hours",
    },
    {
      key: "tables",
      title: "Floor plan",
      description: "Add your tables and capacities",
      done: tablesCount > 0,
      href: "/floor",
    },
    {
      key: "rules",
      title: "Reservation rules",
      description: "Lead time, slot length, party limits",
      done: !!settings,
      href: "/settings/rules",
    },
    {
      key: "tags",
      title: "Guest tags",
      description: "Categorize regulars and special diets",
      done: tagCount > 0,
      href: "/guests",
    },
    {
      key: "integrations",
      title: "Integrations (optional)",
      description: "Stripe deposits, API keys, webhooks",
      done: !!subscription?.stripeDepositsEnabled,
      href: "/settings/integrations",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const isComplete = completed === steps.length - 1; // integrations are optional

  return (
    <div className="mx-auto max-w-[900px] animate-fade-in space-y-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Get set up
        </p>
        <h1 className="mt-3 flex items-center gap-3 text-4xl tracking-tight">
          Welcome
          <Sparkles className="h-7 w-7 text-primary/60" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          You're a few steps away from taking your first reservation. Most owners finish this in
          under ten minutes.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {completed}/{steps.length}
          </p>
        </div>
      </div>

      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={`group flex items-center gap-4 rounded-lg border p-4 transition ${
                step.done
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success" />
              ) : (
                <Circle className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
            </Link>
          </li>
        ))}
      </ol>

      {isComplete ? (
        <div className="rounded-lg border-2 border-success/40 bg-success/5 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <h2 className="mt-3 font-display text-2xl tracking-tight">You're all set</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your public booking widget is live at{" "}
            <code className="font-mono text-xs">{`/book/${tenant?.slug}`}</code>.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Go to dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
