"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ShieldAlert, Lock } from "lucide-react";
import {
  updateStripeSettingsAction,
  updateDepositSettingsAction,
} from "@/server/actions/integrations.actions";
import { cn } from "@/lib/utils";

type StripeProps = {
  stripe: {
    enabled: boolean;
    publishableKey: string | null;
    hasSecretKey: boolean;
    hasWebhookSecret: boolean;
  };
  deposits: {
    depositPerPerson: number | null;
    depositRefundPolicy: string | null;
  };
};

export function StripeSettingsPanel({ stripe, deposits }: StripeProps) {
  const router = useRouter();
  const [pendingS, startS] = useTransition();
  const [pendingD, startD] = useTransition();

  const [enabled, setEnabled] = useState(stripe.enabled);
  const [publishableKey, setPublishableKey] = useState(stripe.publishableKey ?? "");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const [depositPerPerson, setDepositPerPerson] = useState<string>(
    deposits.depositPerPerson != null ? String(deposits.depositPerPerson) : "",
  );
  const [refundPolicy, setRefundPolicy] = useState(deposits.depositRefundPolicy ?? "");

  function saveStripe() {
    startS(async () => {
      const res = await updateStripeSettingsAction({
        enabled,
        publishableKey: publishableKey.trim(),
        secretKey: secretKey.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      });
      if (res.ok) {
        toast.success("Stripe settings saved");
        setSecretKey("");
        setWebhookSecret("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function saveDeposits() {
    startD(async () => {
      const raw = depositPerPerson.trim();
      const value = raw === "" ? null : Number(raw);
      if (value !== null && (Number.isNaN(value) || value < 0)) {
        toast.error("Invalid deposit amount");
        return;
      }
      const res = await updateDepositSettingsAction({
        depositPerPerson: value,
        depositRefundPolicy: refundPolicy.trim() || undefined,
      });
      if (res.ok) {
        toast.success("Deposit policy saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Credentials */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Credentials
          </p>
          {stripe.hasSecretKey && stripe.hasWebhookSecret ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-success">
              <CheckCircle2 className="h-3 w-3" /> Configured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-warning">
              <ShieldAlert className="h-3 w-3" /> Not yet
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Publishable key" hint="pk_test_… or pk_live_…">
            <Input
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder="pk_…"
            />
          </Field>
          <Field
            label="Secret key"
            hint={stripe.hasSecretKey ? "Already set — leave blank to keep" : "sk_test_… or restricted key"}
          >
            <Input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={stripe.hasSecretKey ? "•••• already configured" : "sk_…"}
            />
          </Field>
          <Field
            label="Webhook signing secret"
            hint={stripe.hasWebhookSecret ? "Already set" : "whsec_… from Stripe dashboard"}
          >
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={stripe.hasWebhookSecret ? "•••• already configured" : "whsec_…"}
            />
          </Field>

          <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
            <div>
              <p className="font-medium">Charge guest deposits</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                When on, the public widget routes bookers through Stripe Checkout.
              </p>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>

          <button
            onClick={saveStripe}
            disabled={pendingS}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {pendingS ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Save credentials
          </button>
        </div>

        <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
          Stripe's webhook endpoint should point to{" "}
          <code className="rounded bg-muted px-1 font-mono text-[10px]">
            {`{APP_URL}/api/webhooks/stripe`}
          </code>{" "}
          and subscribe to <code className="font-mono">checkout.session.completed</code>,{" "}
          <code className="font-mono">payment_intent.succeeded</code>, and{" "}
          <code className="font-mono">payment_intent.payment_failed</code>.
        </p>
      </div>

      {/* Deposit policy */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Deposit policy
        </p>
        <div className="mt-4 space-y-3">
          <Field
            label="Deposit per person"
            hint="USD. Leave blank to disable. Example: 20 → $20/guest at booking."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min={0}
                step="1"
                value={depositPerPerson}
                onChange={(e) => setDepositPerPerson(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </Field>
          <Field label="Refund policy text" hint="Shown on the booking widget">
            <textarea
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value)}
              rows={4}
              placeholder="e.g. Deposits are refundable up to 24 hours before your reservation."
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <button
            onClick={saveDeposits}
            disabled={pendingD}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {pendingD ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save deposit policy
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
    />
  );
}
