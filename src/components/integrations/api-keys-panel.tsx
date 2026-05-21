"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Loader2, Trash2, Copy, AlertTriangle, KeyRound } from "lucide-react";
import {
  createApiKeyAction,
  revokeApiKeyAction,
} from "@/server/actions/integrations.actions";
import { API_SCOPES, type ApiScope } from "@/lib/validators/integrations";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function ApiKeysPanel({ apiKeys }: { apiKeys: ApiKeyRow[] }) {
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ plaintext: string; name: string } | null>(null);

  return (
    <div className="space-y-3">
      {/* One-time reveal */}
      {revealed ? (
        <RevealedKey
          plaintext={revealed.plaintext}
          name={revealed.name}
          onClose={() => setRevealed(null)}
        />
      ) : null}

      {creating ? (
        <CreateForm
          onClose={() => setCreating(false)}
          onCreated={(plaintext, name) => {
            setCreating(false);
            setRevealed({ plaintext, name });
          }}
        />
      ) : null}

      {apiKeys.length === 0 && !creating ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <KeyRound className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No API keys yet. Create one to let partners or scripts access your data.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {apiKeys.map((k) => (
            <ApiKeyRowItem key={k.id} apiKey={k} />
          ))}
        </ul>
      )}

      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border bg-card/50 px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          New API key
        </button>
      ) : null}

      <p className="border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        Use this header to authenticate:{" "}
        <code className="rounded bg-muted px-1 font-mono text-[10px]">
          Authorization: Bearer rk_live_…
        </code>
        . Try{" "}
        <code className="font-mono">curl -H "Authorization: Bearer KEY" {`{APP_URL}/api/v1/reservations`}</code>{" "}
        once you have a key.
      </p>
    </div>
  );
}

function ApiKeyRowItem({ apiKey }: { apiKey: ApiKeyRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const revoked = !!apiKey.revokedAt;

  function revoke() {
    if (!confirm(`Revoke "${apiKey.name}"? Any partner using it will be locked out immediately.`))
      return;
    start(async () => {
      const res = await revokeApiKeyAction(apiKey.id);
      if (res.ok) {
        toast.success("API key revoked");
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
        revoked && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {apiKey.name}
            {revoked ? (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-destructive">
                revoked
              </span>
            ) : null}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {apiKey.prefix}…
          </p>
          <p className="mt-2 flex flex-wrap gap-1">
            {apiKey.scopes.map((s) => (
              <code
                key={s}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {s}
              </code>
            ))}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {apiKey.lastUsedAt
              ? `Last used ${formatRelative(apiKey.lastUsedAt)}`
              : `Created ${formatRelative(apiKey.createdAt)}`}
          </p>
          {!revoked ? (
            <button
              onClick={revoke}
              disabled={pending}
              className="inline-flex h-7 items-center gap-1 rounded px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              title="Revoke this key"
            >
              <Trash2 className="h-3 w-3" />
              Revoke
            </button>
          ) : null}
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
  onCreated: (plaintext: string, name: string) => void;
}) {
  const router = useRouter();
  const [submitting, start] = useTransition();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>([]);

  function toggle(scope: ApiScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  function submit() {
    if (!name.trim() || scopes.length === 0) return;
    start(async () => {
      const res = await createApiKeyAction({
        name: name.trim(),
        scopes,
      });
      if (res.ok) {
        onCreated(res.data.plaintext, name.trim());
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
          New API key
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 space-y-3">
        <input
          autoFocus
          placeholder="Key name — e.g. 'OpenTable sync'"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Scopes
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {API_SCOPES.map((scope) => {
              const active = scopes.includes(scope);
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggle(scope)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] transition",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {scope}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={!name.trim() || scopes.length === 0 || submitting}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
            (!name.trim() || scopes.length === 0 || submitting) && "opacity-50",
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create key
        </button>
      </div>
    </div>
  );
}

function RevealedKey({
  plaintext,
  name,
  onClose,
}: {
  plaintext: string;
  name: string;
  onClose: () => void;
}) {
  function copy() {
    navigator.clipboard.writeText(plaintext);
    toast.success("Copied to clipboard");
  }
  return (
    <div className="rounded-lg border-2 border-warning bg-warning/5 p-5">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          Save this key now — you won't see it again
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-2 text-sm">
        New API key <strong>{name}</strong>:
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background p-3">
        <code className="flex-1 truncate font-mono text-xs">{plaintext}</code>
        <button
          onClick={copy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs hover:bg-secondary"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Store this in your secrets manager. We only keep a hash on our side; lose this string and
        you'll need to issue a new key.
      </p>
    </div>
  );
}
