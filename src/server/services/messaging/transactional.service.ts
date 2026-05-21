import { prisma, tenantDb } from "@/server/db";
import { MessageChannel } from "@prisma/client";
import { sendEmail } from "./email";
import { renderTemplate } from "./render";
import { writeAuditPublic } from "@/server/audit";

/**
 * Build the context object for token interpolation given the tenant + guest +
 * (optionally) reservation. Anything missing renders as empty.
 */
function buildContext(input: {
  tenant: { name: string; contactPhone: string | null; addressLine1: string | null; city: string | null; state: string | null };
  guest: { firstName: string; lastName: string | null; email: string | null; phone: string | null };
  reservation?: {
    startTime: Date;
    partySize: number;
    confirmationCode: string;
    occasion: string | null;
  };
  loyalty?: { currentPoints: number; tierName: string };
}): Record<string, string> {
  const r = input.reservation;
  const date = r
    ? r.startTime.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const time = r
    ? r.startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  return {
    firstName: input.guest.firstName,
    lastName: input.guest.lastName ?? "",
    fullName: `${input.guest.firstName} ${input.guest.lastName ?? ""}`.trim(),
    email: input.guest.email ?? "",
    phone: input.guest.phone ?? "",
    restaurantName: input.tenant.name,
    restaurantPhone: input.tenant.contactPhone ?? "",
    restaurantAddress: [input.tenant.addressLine1, input.tenant.city, input.tenant.state]
      .filter(Boolean)
      .join(", "),
    reservationDate: date,
    reservationTime: time,
    partySize: r ? String(r.partySize) : "",
    confirmationCode: r ? r.confirmationCode.slice(0, 8).toUpperCase() : "",
    occasion: r?.occasion ?? "",
    currentPoints: input.loyalty?.currentPoints != null ? String(input.loyalty.currentPoints) : "",
    tierName: input.loyalty?.tierName ?? "",
  };
}

/**
 * Wrap rendered content in a minimal branded HTML shell. This is the part the
 * email client actually renders — keep it inline-styled and conservative.
 */
function wrapHtml(opts: { tenantName: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(opts.tenantName)}</title></head>
<body style="margin:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#2A2825;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#FFFFFF;border:1px solid #E8E2D5;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px 40px 16px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8C857A;">${escapeHtml(opts.tenantName)}</p>
        </td></tr>
        <tr><td style="padding:8px 40px 32px;line-height:1.6;font-size:15px;">${opts.bodyHtml}</td></tr>
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

// ---------------------------------------------------------------------
// Built-in defaults — used when the tenant hasn't customized a template
// ---------------------------------------------------------------------

const DEFAULT_BOOKING_CONFIRMATION = {
  subject: "Your reservation at {{restaurantName}} is confirmed",
  html: `<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;font-weight:500;color:#2A2825;">You're all set, {{firstName}}.</h1>
<p>We've saved a table for <strong>{{partySize}}</strong> on <strong>{{reservationDate}}</strong> at <strong>{{reservationTime}}</strong>.</p>
<p style="margin:24px 0;padding:16px;background:#FAF8F4;border-radius:6px;font-family:monospace;letter-spacing:0.15em;font-size:15px;">Confirmation: <strong>{{confirmationCode}}</strong></p>
<p>If you need to make any changes, call us at <a href="tel:{{restaurantPhone}}" style="color:#B5462E;">{{restaurantPhone}}</a> or reply to this email.</p>
<p style="margin-top:32px;color:#8C857A;font-size:13px;">{{restaurantName}} · {{restaurantAddress}}</p>`,
};

const DEFAULT_CANCELLATION = {
  subject: "Your reservation at {{restaurantName}} has been cancelled",
  html: `<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;font-weight:500;color:#2A2825;">Your reservation is cancelled, {{firstName}}.</h1>
<p>The reservation on <strong>{{reservationDate}}</strong> at <strong>{{reservationTime}}</strong> for <strong>{{partySize}}</strong> has been cancelled.</p>
<p>We'd love to see you another time — book again whenever you're ready.</p>
<p style="margin-top:32px;color:#8C857A;font-size:13px;">{{restaurantName}} · {{restaurantAddress}}</p>`,
};

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------

/**
 * Resolve a template — first look for a tenant-defined one in the given
 * category, then fall back to the system default.
 */
async function resolveTemplate(
  tenantId: string,
  category: string,
  fallback: { subject: string; html: string },
) {
  const tenantTemplate = await prisma.messageTemplate.findFirst({
    where: { tenantId, channel: MessageChannel.EMAIL, category },
    orderBy: { updatedAt: "desc" },
  });
  if (tenantTemplate?.content) {
    return {
      subject: tenantTemplate.subject ?? fallback.subject,
      html: tenantTemplate.content,
      source: "tenant" as const,
    };
  }
  return { ...fallback, source: "default" as const };
}

/**
 * Send a booking confirmation. Used by the public widget after a successful
 * booking and (optionally) by host-initiated bookings.
 */
export async function sendBookingConfirmation(params: {
  tenantId: string;
  reservationId: string;
}): Promise<{ sent: boolean; mode?: "live" | "console" }> {
  const reservation = await prisma.reservation.findFirst({
    where: { id: params.reservationId, tenantId: params.tenantId },
    include: {
      tenant: true,
      guest: true,
    },
  });
  if (!reservation) return { sent: false };
  const tenant = reservation.tenant;
  const guest = reservation.guest;

  // Prefer denormalized email from the reservation (works for walk-in style
  // bookings where we have contact info but no guest row, even though our
  // public widget always creates one).
  const recipientEmail = guest?.email ?? reservation.guestEmail;
  if (!recipientEmail) return { sent: false };

  const tpl = await resolveTemplate(tenant.id, "booking_confirmation", DEFAULT_BOOKING_CONFIRMATION);

  const context = buildContext({
    tenant,
    guest: {
      firstName: guest?.firstName ?? reservation.guestFirstName ?? "Guest",
      lastName: guest?.lastName ?? reservation.guestLastName ?? null,
      email: recipientEmail,
      phone: guest?.phone ?? reservation.guestPhone,
    },
    reservation,
  });

  const html = wrapHtml({ tenantName: tenant.name, bodyHtml: renderTemplate(tpl.html, context) });
  const subject = renderTemplate(tpl.subject, context);

  const result = await sendEmail({
    to: recipientEmail,
    subject,
    html,
    fromName: tenant.name,
  });

  // Stamp confirmationSentAt so the reservation timeline records it
  if (result.ok) {
    await tenantDb(tenant.id)
      .reservation.update({
        where: { id: reservation.id },
        data: { confirmationSentAt: new Date() },
      })
      .catch(() => null);

    await writeAuditPublic({
      tenantId: tenant.id,
      action: "messaging.confirmation.sent",
      entityType: "Reservation",
      entityId: reservation.id,
      changes: { after: { to: recipientEmail, template: tpl.source, mode: result.mode } },
    });
  }

  return { sent: result.ok, mode: result.ok ? result.mode : undefined };
}

/**
 * Send a cancellation notice. Fires from the reservation state machine when
 * an action="cancel" transition succeeds.
 */
export async function sendCancellationNotice(params: {
  tenantId: string;
  reservationId: string;
}): Promise<{ sent: boolean; mode?: "live" | "console" }> {
  const reservation = await prisma.reservation.findFirst({
    where: { id: params.reservationId, tenantId: params.tenantId },
    include: { tenant: true, guest: true },
  });
  if (!reservation) return { sent: false };
  const recipientEmail = reservation.guest?.email ?? reservation.guestEmail;
  if (!recipientEmail) return { sent: false };

  const tpl = await resolveTemplate(reservation.tenant.id, "cancellation", DEFAULT_CANCELLATION);

  const context = buildContext({
    tenant: reservation.tenant,
    guest: {
      firstName: reservation.guest?.firstName ?? reservation.guestFirstName ?? "Guest",
      lastName: reservation.guest?.lastName ?? reservation.guestLastName ?? null,
      email: recipientEmail,
      phone: reservation.guest?.phone ?? reservation.guestPhone,
    },
    reservation,
  });

  const result = await sendEmail({
    to: recipientEmail,
    subject: renderTemplate(tpl.subject, context),
    html: wrapHtml({
      tenantName: reservation.tenant.name,
      bodyHtml: renderTemplate(tpl.html, context),
    }),
    fromName: reservation.tenant.name,
  });

  if (result.ok) {
    await writeAuditPublic({
      tenantId: reservation.tenant.id,
      action: "messaging.cancellation.sent",
      entityType: "Reservation",
      entityId: reservation.id,
      changes: { after: { to: recipientEmail, template: tpl.source, mode: result.mode } },
    });
  }

  return { sent: result.ok, mode: result.ok ? result.mode : undefined };
}
