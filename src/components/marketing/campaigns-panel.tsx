"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Send,
  Mail,
  MessageSquare,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
} from "lucide-react";
import { MessageChannel, CampaignStatus } from "@prisma/client";
import {
  createCampaignAction,
  sendCampaignAction,
} from "@/server/actions/marketing.actions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Campaign = {
  id: string;
  name: string;
  channel: MessageChannel;
  status: CampaignStatus;
  subject: string | null;
  createdAt: string;
  sentAt: string | null;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  segment: { id: string; name: string } | null;
  template: { id: string; name: string } | null;
};

type SegmentLite = { id: string; name: string; memberCount: number };
type TemplateLite = {
  id: string;
  name: string;
  channel: MessageChannel;
  subject: string | null;
  content: string;
};

export function CampaignsPanel({
  campaigns,
  segments,
  templates,
  canManage,
}: {
  campaigns: Campaign[];
  segments: SegmentLite[];
  templates: TemplateLite[];
  canManage: boolean;
}) {
  const [composing, setComposing] = useState(false);

  return (
    <div className="space-y-3">
      {composing ? (
        <CampaignComposer
          segments={segments}
          templates={templates}
          onClose={() => setComposing(false)}
        />
      ) : null}

      {campaigns.length === 0 && !composing ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Send className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No campaigns yet. Compose your first blast.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {campaigns.map((c) => (
            <CampaignRow key={c.id} campaign={c} canManage={canManage} />
          ))}
        </ul>
      )}

      {canManage && !composing ? (
        <button
          onClick={() => setComposing(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border bg-card/50 px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          New campaign
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------

function CampaignRow({ campaign, canManage }: { campaign: Campaign; canManage: boolean }) {
  const router = useRouter();
  const [sending, start] = useTransition();
  const channelIcon =
    campaign.channel === MessageChannel.EMAIL ? (
      <Mail className="h-3.5 w-3.5" />
    ) : (
      <MessageSquare className="h-3.5 w-3.5" />
    );

  function send() {
    if (
      !confirm(
        `Send "${campaign.name}" to ${campaign.recipientCount} recipients? This can't be undone.`,
      )
    )
      return;
    start(async () => {
      const res = await sendCampaignAction({ campaignId: campaign.id });
      if (res.ok) {
        toast.success(
          `Sent · ${res.data.sent} delivered${res.data.failed > 0 ? ` · ${res.data.failed} failed` : ""}`,
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const canSend =
    canManage &&
    (campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.SCHEDULED);
  const openRate =
    campaign.deliveredCount > 0
      ? Math.round((campaign.openedCount / campaign.deliveredCount) * 100)
      : 0;
  const clickRate =
    campaign.deliveredCount > 0
      ? Math.round((campaign.clickedCount / campaign.deliveredCount) * 100)
      : 0;

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{channelIcon}</span>
            {campaign.name}
            <CampaignStatusPill status={campaign.status} />
          </p>
          {campaign.subject ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              <span className="font-mono uppercase tracking-wider">Subject ·</span>{" "}
              {campaign.subject}
            </p>
          ) : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {campaign.segment ? (
              <span>
                Segment ·{" "}
                <span className="font-medium text-foreground">{campaign.segment.name}</span>
              </span>
            ) : null}
            {campaign.template ? (
              <span>
                Template ·{" "}
                <span className="font-medium text-foreground">{campaign.template.name}</span>
              </span>
            ) : null}
            <span className="font-mono">
              {campaign.sentAt
                ? `Sent ${formatRelative(campaign.sentAt)}`
                : `Created ${formatRelative(campaign.createdAt)}`}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {campaign.status === CampaignStatus.SENT ? (
            <div className="grid grid-cols-3 gap-3 text-right">
              <Stat label="Sent" value={campaign.sentCount.toLocaleString()} />
              <Stat label="Open" value={`${openRate}%`} />
              <Stat label="Click" value={`${clickRate}%`} />
            </div>
          ) : (
            <p className="font-display text-xl tabular-nums">
              {campaign.recipientCount.toLocaleString()}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                recipients
              </span>
            </p>
          )}
          {canSend ? (
            <button
              onClick={send}
              disabled={sending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Send now
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}

function CampaignStatusPill({ status }: { status: CampaignStatus }) {
  const map: Record<CampaignStatus, { label: string; className: string; icon: React.ReactNode }> = {
    DRAFT: {
      label: "Draft",
      className: "bg-muted text-muted-foreground",
      icon: <FileText className="h-3 w-3" />,
    },
    SCHEDULED: {
      label: "Scheduled",
      className: "bg-warning/15 text-warning ring-warning/30",
      icon: <Clock className="h-3 w-3" />,
    },
    SENDING: {
      label: "Sending",
      className: "bg-primary/15 text-primary ring-primary/30",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    SENT: {
      label: "Sent",
      className: "bg-success/15 text-success ring-success/30",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    PAUSED: {
      label: "Paused",
      className: "bg-muted text-muted-foreground",
      icon: <Clock className="h-3 w-3" />,
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-muted text-muted-foreground line-through",
      icon: <X className="h-3 w-3" />,
    },
    FAILED: {
      label: "Failed",
      className: "bg-destructive/15 text-destructive ring-destructive/30",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
  };
  const v = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ring-1 ring-border",
        v.className,
      )}
    >
      {v.icon}
      {v.label}
    </span>
  );
}

// ---------------------------------------------------------------------

function CampaignComposer({
  segments,
  templates,
  onClose,
}: {
  segments: SegmentLite[];
  templates: TemplateLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [submitting, start] = useTransition();
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "");
  const [templateId, setTemplateId] = useState("");
  const [channel, setChannel] = useState<MessageChannel>(MessageChannel.EMAIL);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sendImmediately, setSendImmediately] = useState(false);

  // Pre-fill from template
  useEffect(() => {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setChannel(tpl.channel);
    if (tpl.subject) setSubject(tpl.subject);
    setContent(tpl.content);
  }, [templateId, templates]);

  const selectedSegment = segments.find((s) => s.id === segmentId);
  const recipientCount = selectedSegment?.memberCount ?? 0;

  function submit() {
    if (!segmentId) {
      toast.error("Pick a segment");
      return;
    }
    const payload = {
      name: name.trim(),
      segmentId,
      templateId: templateId || undefined,
      channel,
      subject: channel === MessageChannel.EMAIL ? subject.trim() : undefined,
      content: content.trim(),
    };
    start(async () => {
      const res = await createCampaignAction(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (sendImmediately) {
        const sendRes = await sendCampaignAction({ campaignId: res.data.id });
        if (sendRes.ok) {
          toast.success(`Campaign sent · ${sendRes.data.sent} delivered`);
        } else {
          toast.error(`Created but send failed: ${sendRes.error}`);
        }
      } else {
        toast.success("Campaign saved as draft");
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          New campaign
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <input
            autoFocus
            placeholder="Campaign name — e.g. April happy hour blast"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Segment
              </p>
              <select
                value={segmentId}
                onChange={(e) => setSegmentId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {segments.length === 0 ? (
                  <option value="">No segments — create one above</option>
                ) : (
                  segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.memberCount.toLocaleString()})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Template (optional)
              </p>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— blank —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as MessageChannel)}
            className="h-10 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={MessageChannel.EMAIL}>Email</option>
            <option value={MessageChannel.SMS}>SMS</option>
          </select>

          {channel === MessageChannel.EMAIL ? (
            <input
              placeholder="Subject — supports {{firstName}} tokens"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : null}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder={
              channel === MessageChannel.EMAIL
                ? "HTML body — {{firstName}}, {{restaurantName}}, etc."
                : "Plain-text SMS body — keep it short, supports tokens."
            }
            className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={sendImmediately}
              onChange={(e) => setSendImmediately(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            <span>
              Send immediately after creating{" "}
              <span className="text-muted-foreground">
                (otherwise saves as a draft)
              </span>
            </span>
          </label>

          <button
            onClick={submit}
            disabled={!name.trim() || !content.trim() || !segmentId || submitting}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
              (!name.trim() || !content.trim() || !segmentId || submitting) && "opacity-50",
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {sendImmediately ? "Create & send" : "Save draft"}
          </button>
        </div>

        <aside className="space-y-3 rounded-md border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Will reach
          </p>
          <p className="font-display text-3xl tabular-nums">
            {recipientCount.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {recipientCount === 1 ? "guest" : "guests"}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Recipients are filtered to those with{" "}
            {channel === MessageChannel.EMAIL ? "email opt-in" : "SMS opt-in"} at send time.
          </p>
        </aside>
      </div>
    </div>
  );
}
