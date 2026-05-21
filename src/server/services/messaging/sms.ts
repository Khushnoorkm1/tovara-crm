/**
 * SMS sender — Twilio HTTP API, no SDK. Dev mode logs to console.
 */

export type SendSmsInput = {
  to: string;
  body: string;
};

export type SendSmsResult =
  | { ok: true; providerMessageId: string; mode: "live" | "console" }
  | { ok: false; error: string };

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_FROM_PHONE;

  if (!accountSid || !authToken || !fromPhone) {
    const msgId = `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      `\n📱 [sms/console] → ${input.to}\n` +
        `   ${input.body}\n` +
        `   ID: ${msgId}\n`,
    );
    return { ok: true, providerMessageId: msgId, mode: "console" };
  }

  try {
    const body = new URLSearchParams({
      From: fromPhone,
      To: input.to,
      Body: input.body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    if (!res.ok) {
      const t = await res.text();
      console.error("[sms/twilio] failed:", res.status, t);
      return { ok: false, error: `Twilio ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as { sid: string };
    return { ok: true, providerMessageId: data.sid, mode: "live" };
  } catch (err) {
    console.error("[sms/twilio] network error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
