/**
 * Email sender. Uses Resend's HTTP API directly — no SDK dependency.
 *
 * Dev mode: if RESEND_API_KEY isn't set, log to console and return a synthetic
 * message ID. This way the rest of the system (CampaignRecipient updates, audit
 * logs, etc.) works identically in dev and prod.
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
};

export type SendEmailResult = {
  ok: true;
  providerMessageId: string;
  mode: "live" | "console";
} | {
  ok: false;
  error: string;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const defaultFromEmail = process.env.MAIL_FROM_EMAIL ?? "no-reply@tavola.app";
  const defaultFromName = process.env.MAIL_FROM_NAME ?? "Tavola";

  const fromEmail = input.fromEmail ?? defaultFromEmail;
  const fromName = input.fromName ?? defaultFromName;
  const fromHeader = `${fromName} <${fromEmail}>`;

  if (!apiKey) {
    // Dev mode — log a compact summary so you can verify the wire without a key
    const msgId = `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      `\n📧 [email/console] → ${input.to}\n` +
        `   From:    ${fromHeader}\n` +
        `   Subject: ${input.subject}\n` +
        `   ID:      ${msgId}\n`,
    );
    return { ok: true, providerMessageId: msgId, mode: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email/resend] failed:", res.status, body);
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id: string };
    return { ok: true, providerMessageId: data.id, mode: "live" };
  } catch (err) {
    console.error("[email/resend] network error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
