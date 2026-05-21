"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  X,
  Loader2,
  Trash2,
  Webhook as WebhookIcon,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Power,
  PowerOff,
} from "lucide-react";
import {
  createWebhookAction,
  updateWebhookAction,
  deleteWebhookAction,
} from "@/server/actions/integrations.actions";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/validators/integrations";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: number | null;
  failureCount: number;
  deliveryCount: number;
  createdAt: string;
};

type Delivery = {
  id: string;
  event: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  responseCode: number | null;
  attemptCount: number;
  createdAt: string;
  webhookUrl: string;
};

export function WebhooksPanel({
  webhooks,
  recentDeliveries,
}: {
  webhooks: WebhookRow[];
  recentDeliveries: Delivery[];
}) {
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ secret: string; url: string } | null>(
    null,
  );

  return (
    <div className="space-y-6">
      {revealedSecret ? (
        <RevealedSecret
          secret={revealedSecret.secret}
          url={revealedSecret.url}
          onClose={() => setRevealedSecret(null)}
        />
      ) : null}

      {creating ? (
        <CreateForm
          onClose={() => setCreating(false)}
          onCreated={(secret, url) => {
            setCreating(false);
            setRevealedSecret({ secret, url });
          }}
        />
      ) : null}

      {webhooks.length === 0 && !creating ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <WebhookIcon className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No webhook endpoints yet. Subscribe a URL to get notified when things happen.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {webhooks.map((w) => (
            <WebhookRowItem key={w.id} webhook={w} />
          ))}
        </ul>
      )}

      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border bg-card/50 px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add endpoint
        </button>
      ) : null}

      {recentDeliveries.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Recent deliveries
          </p>
          <ul className="mt-3 space-y-1.5">
            {recentDeliveries.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded border border-border bg-background px-3 py-2 text-xs"
              >
                <span className="flex items-center gap-2">
                  {d.status === "SUCCESS" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : d.status === "FAILED" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  <code className="font-mono">{d.event}</code>
                </span>
                <span className="hidden truncate font-mono text-[10px] text-muted-foreground sm:inline">
                  {d.webhookUrl}
                </span>
                <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  {d.responseCode ? `HTTP ${d.responseCode}` : "—"}
                  {d.attemptCount > 1 ? ` · ${d.attemptCount}/3` : ""}
                  <span>{formatRelative(d.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function WebhookRowItem({ webhook }: { webhook: WebhookRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const lastOk = webhook.lastDeliveryStatus && webhook.lastDeliveryStatus < 400;

  function toggle() {
    start(async () => {
      const res = await updateWebhookAction(webhook.id, { isActive: !webhook.isActive });
      if (res.ok) {
        toast.success(webhook.isActive ? "Endpoint paused" : "Endpoint activated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove() {
    if (!confirm(`Delete endpoint ${webhook.url}?`)) return;
    start(async () => {
      const res = await deleteWebhookAction(webhook.id);
      if (res.ok) {
        toast.success("Endpoint deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        !webhook.isActive && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <code className="truncate font-mono">{webhook.url}</code>
            {!webhook.isActive ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                paused
              </span>
            ) : null}
            {webhook.failureCount > 3 ? (
              <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-destructive">
                <AlertTriangle className="h-2.5 w-2.5" />
                {webhook.failureCount} failures
              </span>
            ) : null}
          </p>
          <p className="mt-2 flex flex-wrap gap-1">
            {webhook.events.map((e) => (
              <code
                key={e}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {e}
              </code>
            ))}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {webhook.lastDeliveryAt
              ? `Last ${formatRelative(webhook.lastDeliveryAt)} · ${webhook.lastDeliveryStatus ?? "?"}`
              : `Created ${formatRelative(webhook.createdAt)}`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              disabled={pending}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
              title={webhook.isActive ? "Pause" : "Activate"}
            >
              {webhook.isActive ? (
                <PowerOff className="h-3 w-3" />
              ) : (
                <Power className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={remove}
              disabled={pending}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function CreateForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (secret: string, url: string) => void;
}) {
  const router = useRouter();
  const [submitting, start] = useTransition();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  function toggle(event: WebhookEvent) {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  function submit() {
    if (!url.trim() || events.length === 0) return;
    start(async () => {
      const res = await createWebhookAction({ url: url.trim(), events });
      if (res.ok) {
        onCreated(res.data.secret, url.trim());
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          New webhook endpoint
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 space-y-3">
        <input
          autoFocus
          placeholder="https://your-system.example/webhooks/tavola"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Subscribed events
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {WEBHOOK_EVENTS.map((event) => {
              const active = events.includes(event);
              return (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggle(event)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] transition",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {event}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={!url.trim() || events.length === 0 || submitting}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
            (!url.trim() || events.length === 0 || submitting) && "opacity-50",
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create endpoint
        </button>
      </div>
    </div>
  );
}

function RevealedSecret({
  secret,
  url,
  onClose,
}: {
  secret: string;
  url: string;
  onClose: () => void;
}) {
  function copy() {
    navigator.clipboard.writeText(secret);
    toast.success("Copied to clipboard");
  }
  return (
    <div className="rounded-lg border-2 border-warning bg-warning/5 p-5">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          Save this signing secret — required to verify deliveries
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-2 text-sm">
        Endpoint created: <code className="font-mono text-xs">{url}</code>
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background p-3">
        <code className="flex-1 truncate font-mono text-xs">{secret}</code>
        <button
          onClick={copy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs hover:bg-secondary"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Deliveries include an{" "}
        <code className="rounded bg-muted px-1 font-mono text-[10px]">X-Tavola-Signature</code>{" "}
        header of the form{" "}
        <code className="rounded bg-muted px-1 font-mono text-[10px]">sha256=…</code>. Verify it by
        recomputing the HMAC-SHA256 of the raw body using this secret.
      </p>
    </div>
  );
}
