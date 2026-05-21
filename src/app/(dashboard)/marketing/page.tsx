import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Users, Send, FileText } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { listTemplates } from "@/server/services/message-template.service";
import { listSegments } from "@/server/services/segment.service";
import { listCampaigns } from "@/server/services/campaign.service";
import { listTags } from "@/server/services/guest-tag.service";
import { TemplatesPanel } from "@/components/marketing/templates-panel";
import { SegmentsPanel } from "@/components/marketing/segments-panel";
import { CampaignsPanel } from "@/components/marketing/campaigns-panel";

export const metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "marketing.view")) redirect("/dashboard");

  const [templates, segments, campaigns, tags] = await Promise.all([
    listTemplates(ctx),
    listSegments(ctx),
    listCampaigns(ctx),
    listTags(ctx),
  ]);

  // Pull loyalty tiers for segment rules — optional dep
  const tiers = await ctx.db.loyaltyTier.findMany({ orderBy: { displayOrder: "asc" } });

  const canManage = hasPermission(ctx.role, "marketing.manage");
  const isResendConfigured = !!process.env.RESEND_API_KEY;

  return (
    <div className="mx-auto max-w-[1200px] animate-fade-in space-y-14">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Relationships
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">Marketing</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Templates, segments, campaigns. Booking confirmations and cancellations send
          automatically when the program is active.
        </p>
        {!isResendConfigured ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            <Mail className="h-3.5 w-3.5" />
            Resend not configured — emails currently log to the dev console. Add{" "}
            <code className="font-mono">RESEND_API_KEY</code> to <code className="font-mono">.env.local</code> to send for real.
          </p>
        ) : null}
      </div>

      {/* 01 — Templates */}
      <SectionHeader number="01" title="Message templates" icon={<FileText className="h-4 w-4" />} />
      <TemplatesPanel
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          channel: t.channel,
          category: t.category,
          subject: t.subject,
          content: t.content,
          variables: t.variables,
          isSystem: t.isSystem,
          updatedAt: t.updatedAt.toISOString(),
        }))}
        canManage={canManage}
      />

      {/* 02 — Segments */}
      <SectionHeader number="02" title="Segments" icon={<Users className="h-4 w-4" />} />
      <SegmentsPanel
        segments={segments.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          rules: s.rules as Record<string, unknown>,
          memberCount: s._count.members,
          updatedAt: s.updatedAt.toISOString(),
        }))}
        tags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        tiers={tiers.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        canManage={canManage}
      />

      {/* 03 — Campaigns */}
      <SectionHeader number="03" title="Campaigns" icon={<Send className="h-4 w-4" />} />
      <CampaignsPanel
        campaigns={campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          channel: c.channel,
          status: c.status,
          subject: c.subject,
          createdAt: c.createdAt.toISOString(),
          sentAt: c.sentAt?.toISOString() ?? null,
          recipientCount: c.recipientCount,
          sentCount: c.sentCount,
          deliveredCount: c.deliveredCount,
          openedCount: c.openedCount,
          clickedCount: c.clickedCount,
          segment: c.segment ? { id: c.segment.id, name: c.segment.name } : null,
          template: c.template ? { id: c.template.id, name: c.template.name } : null,
        }))}
        segments={segments.map((s) => ({ id: s.id, name: s.name, memberCount: s._count.members }))}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          channel: t.channel,
          subject: t.subject,
          content: t.content,
        }))}
        canManage={canManage}
      />
    </div>
  );
}

function SectionHeader({
  number,
  title,
  icon,
}: {
  number: string;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <header className="flex items-baseline gap-3 border-b border-border pb-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {number}
      </span>
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
    </header>
  );
}
