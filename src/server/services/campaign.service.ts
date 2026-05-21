import {
  Prisma,
  CampaignStatus,
  DeliveryStatus,
  MessageChannel,
} from "@prisma/client";
import type { AuthedContext } from "@/server/tenant";
import { requirePermission, AuthError } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import { renderTemplate } from "./messaging/render";
import { sendEmail } from "./messaging/email";
import { sendSms } from "./messaging/sms";
import type { CreateCampaignInput } from "@/lib/validators/marketing";

const campaignListInclude = {
  segment: { select: { id: true, name: true } },
  template: { select: { id: true, name: true } },
  _count: { select: { recipients: true } },
} satisfies Prisma.CampaignInclude;

export type CampaignListItem = Prisma.CampaignGetPayload<{ include: typeof campaignListInclude }>;

export async function listCampaigns(ctx: AuthedContext) {
  requirePermission(ctx, "marketing.view");
  return ctx.db.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: campaignListInclude,
  });
}

export async function getCampaign(ctx: AuthedContext, id: string) {
  requirePermission(ctx, "marketing.view");
  return ctx.db.campaign.findUnique({
    where: { id },
    include: {
      segment: true,
      template: true,
      recipients: {
        include: { guest: { select: { firstName: true, lastName: true, email: true } } },
        take: 100,
        orderBy: { sentAt: "desc" },
      },
    },
  });
}

export async function createCampaign(ctx: AuthedContext, input: CreateCampaignInput) {
  requirePermission(ctx, "marketing.manage");

  const segment = await ctx.db.segment.findUnique({
    where: { id: input.segmentId },
    include: { _count: { select: { members: true } } },
  });
  if (!segment) throw new AuthError(404, "Segment not found");

  const campaign = await ctx.db.campaign.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      segmentId: input.segmentId,
      templateId: input.templateId ?? null,
      channel: input.channel,
      status: CampaignStatus.DRAFT,
      subject: input.subject || null,
      content: input.content,
      fromName: input.fromName || null,
      fromEmail: input.fromEmail || null,
      createdById: ctx.userId,
      recipientCount: segment._count.members,
    },
    include: campaignListInclude,
  });

  await writeAudit({
    ctx,
    action: "campaign.created",
    entityType: "Campaign",
    entityId: campaign.id,
    changes: { after: { name: campaign.name, segment: segment.name, channel: campaign.channel } },
  });

  return campaign;
}

/**
 * Send a campaign. Loops through the segment's pre-materialized members,
 * renders the content per guest, sends via the appropriate provider, and
 * tracks each delivery row.
 *
 * This is synchronous — fine for the 100-1000 recipient demo scale. For
 * larger blasts, wrap in Inngest / a queue in Phase 9.
 */
export async function sendCampaign(ctx: AuthedContext, campaignId: string) {
  requirePermission(ctx, "marketing.manage");

  const campaign = await ctx.db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      segment: { include: { members: { include: { guest: true } } } },
      template: true,
    },
  });
  if (!campaign) throw new AuthError(404, "Campaign not found");
  if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.SCHEDULED) {
    throw new AuthError(403, `Campaign is already ${campaign.status.toLowerCase()}`);
  }
  if (!campaign.segment) throw new AuthError(403, "Campaign has no segment");

  const tenant = await ctx.db.tenant.findFirst({});
  if (!tenant) throw new AuthError(404, "Tenant not found");

  // Mark sending; failures from here on flip to FAILED, never go back to DRAFT
  await ctx.db.campaign.update({
    where: { id: campaign.id },
    data: { status: CampaignStatus.SENDING },
  });

  const isEmail = campaign.channel === MessageChannel.EMAIL;
  let sent = 0;
  let delivered = 0;
  let failed = 0;

  for (const member of campaign.segment.members) {
    const guest = member.guest;
    const recipient = isEmail ? guest.email : guest.phone;
    const optedIn = isEmail ? guest.marketingEmailOptIn : guest.marketingSmsOptIn;

    // Insert a recipient row up-front so the audit trail is honest even if
    // we bail mid-loop
    const row = await ctx.db.campaignRecipient.create({
      data: {
        campaignId: campaign.id,
        guestId: guest.id,
        status: DeliveryStatus.QUEUED,
      },
    });

    if (!recipient) {
      await ctx.db.campaignRecipient.update({
        where: { id: row.id },
        data: { status: DeliveryStatus.FAILED, errorMessage: "No contact info" },
      });
      failed += 1;
      continue;
    }
    if (!optedIn) {
      await ctx.db.campaignRecipient.update({
        where: { id: row.id },
        data: { status: DeliveryStatus.UNSUBSCRIBED, errorMessage: "Not opted in" },
      });
      continue;
    }

    // Phase 9: per-recipient unsubscribe URL (HMAC-signed, stateless)
    let unsubscribeUrl = "";
    if (isEmail) {
      try {
        const { buildUnsubscribeToken } = await import("./unsubscribe.service");
        const token = await buildUnsubscribeToken(guest.id, ctx.tenantId);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}&campaign=${campaign.id}`;
      } catch (err) {
        console.error("[campaign] unsubscribe token failed:", err);
      }
    }

    const context = {
      firstName: guest.firstName,
      lastName: guest.lastName ?? "",
      fullName: `${guest.firstName} ${guest.lastName ?? ""}`.trim(),
      email: guest.email ?? "",
      phone: guest.phone ?? "",
      restaurantName: tenant.name,
      restaurantPhone: tenant.contactPhone ?? "",
      restaurantAddress: [tenant.addressLine1, tenant.city, tenant.state]
        .filter(Boolean)
        .join(", "),
      unsubscribeUrl,
    };
    const rendered = renderTemplate(campaign.content, context);
    const subject = campaign.subject ? renderTemplate(campaign.subject, context) : "";

    if (isEmail) {
      const result = await sendEmail({
        to: recipient,
        subject: subject || "(no subject)",
        html: wrapCampaignHtml({
          tenantName: tenant.name,
          bodyHtml: rendered,
          unsubscribeUrl,
        }),
        fromName: campaign.fromName ?? tenant.name,
        fromEmail: campaign.fromEmail ?? undefined,
      });
      if (result.ok) {
        await ctx.db.campaignRecipient.update({
          where: { id: row.id },
          data: {
            status: DeliveryStatus.SENT,
            sentAt: new Date(),
            providerMessageId: result.providerMessageId,
          },
        });
        sent += 1;
        delivered += 1;
      } else {
        await ctx.db.campaignRecipient.update({
          where: { id: row.id },
          data: { status: DeliveryStatus.FAILED, errorMessage: result.error },
        });
        failed += 1;
      }
    } else {
      const result = await sendSms({ to: recipient, body: rendered });
      if (result.ok) {
        await ctx.db.campaignRecipient.update({
          where: { id: row.id },
          data: {
            status: DeliveryStatus.SENT,
            sentAt: new Date(),
            providerMessageId: result.providerMessageId,
          },
        });
        sent += 1;
        delivered += 1;
      } else {
        await ctx.db.campaignRecipient.update({
          where: { id: row.id },
          data: { status: DeliveryStatus.FAILED, errorMessage: result.error },
        });
        failed += 1;
      }
    }
  }

  const finalStatus = sent > 0 ? CampaignStatus.SENT : CampaignStatus.FAILED;
  await ctx.db.campaign.update({
    where: { id: campaign.id },
    data: {
      status: finalStatus,
      sentAt: new Date(),
      sentCount: sent,
      deliveredCount: delivered,
      bouncedCount: failed,
    },
  });

  await writeAudit({
    ctx,
    action: "campaign.sent",
    entityType: "Campaign",
    entityId: campaign.id,
    changes: { after: { sent, failed, recipients: campaign.segment.members.length } },
  });

  return { sent, failed, total: campaign.segment.members.length };
}

function wrapCampaignHtml(opts: {
  tenantName: string;
  bodyHtml: string;
  unsubscribeUrl?: string;
}): string {
  const footerLink = opts.unsubscribeUrl
    ? `<p style="margin-top:12px;font-size:11px;color:#8C857A;text-align:center;">
         Don't want these emails?
         <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#8C857A;text-decoration:underline;">Unsubscribe</a>.
       </p>`
    : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${escapeHtml(opts.tenantName)}</title></head>
<body style="margin:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#2A2825;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #E8E2D5;border-radius:8px;">
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 24px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8C857A;">${escapeHtml(opts.tenantName)}</p>
          <div style="line-height:1.6;font-size:15px;">${opts.bodyHtml}</div>
          <p style="margin-top:32px;color:#8C857A;font-size:11px;text-align:center;">${escapeHtml(opts.tenantName)}</p>
          ${footerLink}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
