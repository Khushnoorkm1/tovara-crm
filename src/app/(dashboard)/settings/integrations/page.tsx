import { redirect } from "next/navigation";
import { CreditCard, Key, Webhook } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { listApiKeys } from "@/server/services/api-key.service";
import {
  listWebhooks,
  listRecentDeliveries,
} from "@/server/services/webhook.service";
import { StripeSettingsPanel } from "@/components/integrations/stripe-settings-panel";
import { ApiKeysPanel } from "@/components/integrations/api-keys-panel";
import { WebhooksPanel } from "@/components/integrations/webhooks-panel";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "integration.manage")) redirect("/dashboard");

  const [tenant, subscription, settings, apiKeys, webhooks, deliveries] = await Promise.all([
    ctx.db.tenant.findFirst({}),
    ctx.db.tenantSubscription.findUnique({ where: { tenantId: ctx.tenantId } }),
    ctx.db.reservationSettings.findUnique({ where: { tenantId: ctx.tenantId } }),
    listApiKeys(ctx),
    listWebhooks(ctx),
    listRecentDeliveries(ctx, 25),
  ]);
  if (!tenant) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-[1100px] animate-fade-in space-y-14">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Configure
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">Integrations</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Stripe deposits, public REST API keys for partners, and outbound webhooks for
          listening systems.
        </p>
      </div>

      {/* Stripe + deposits */}
      <section>
        <Header number="01" title="Stripe & deposits" icon={<CreditCard className="h-4 w-4" />} />
        <StripeSettingsPanel
          stripe={{
            enabled: !!subscription?.stripeDepositsEnabled,
            publishableKey: subscription?.stripePublishableKey ?? null,
            hasSecretKey: !!subscription?.stripeSecretKey,
            hasWebhookSecret: !!subscription?.stripeWebhookSecret,
          }}
          deposits={{
            depositPerPerson: settings?.depositPerPerson ?? null,
            depositRefundPolicy: settings?.depositRefundPolicy ?? null,
          }}
        />
      </section>

      {/* API keys */}
      <section>
        <Header number="02" title="API keys" icon={<Key className="h-4 w-4" />} />
        <ApiKeysPanel
          apiKeys={apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            scopes: k.scopes,
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            expiresAt: k.expiresAt?.toISOString() ?? null,
            revokedAt: k.revokedAt?.toISOString() ?? null,
            createdAt: k.createdAt.toISOString(),
          }))}
        />
      </section>

      {/* Webhooks */}
      <section>
        <Header number="03" title="Webhooks" icon={<Webhook className="h-4 w-4" />} />
        <WebhooksPanel
          webhooks={webhooks.map((w) => ({
            id: w.id,
            url: w.url,
            events: w.events,
            isActive: w.isActive,
            lastDeliveryAt: w.lastDeliveryAt?.toISOString() ?? null,
            lastDeliveryStatus: w.lastDeliveryStatus,
            failureCount: w.failureCount,
            deliveryCount: w._count.deliveries,
            createdAt: w.createdAt.toISOString(),
          }))}
          recentDeliveries={deliveries.map((d) => ({
            id: d.id,
            event: d.event,
            status: d.status,
            responseCode: d.responseCode,
            attemptCount: d.attemptCount,
            createdAt: d.createdAt.toISOString(),
            webhookUrl: d.webhook.url,
          }))}
        />
      </section>
    </div>
  );
}

function Header({ number, title, icon }: { number: string; title: string; icon: React.ReactNode }) {
  return (
    <header className="mb-6 flex items-baseline gap-3 border-b border-border pb-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {number}
      </span>
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
    </header>
  );
}
