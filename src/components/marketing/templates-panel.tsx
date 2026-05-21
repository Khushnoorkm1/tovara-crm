"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  MessageSquare,
  Loader2,
  X,
  FileText,
} from "lucide-react";
import { MessageChannel } from "@prisma/client";
import {
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
} from "@/server/actions/marketing.actions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  name: string;
  channel: MessageChannel;
  category: string | null;
  subject: string | null;
  content: string;
  variables: string[];
  isSystem: boolean;
  updatedAt: string;
};

const TOKEN_REFERENCE = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "restaurantName",
  "restaurantPhone",
  "restaurantAddress",
  "reservationDate",
  "reservationTime",
  "partySize",
  "confirmationCode",
  "occasion",
  "currentPoints",
  "tierName",
];

export function TemplatesPanel({
  templates,
  canManage,
}: {
  templates: Template[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {templates.length === 0 && !adding ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No templates yet. Start with a confirmation or welcome message.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) =>
            editingId === t.id ? (
              <TemplateForm
                key={t.id}
                mode="edit"
                template={t}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <TemplateRow
                key={t.id}
                template={t}
                canManage={canManage}
                onEdit={() => setEditingId(t.id)}
              />
            ),
          )}
          {adding ? <TemplateForm mode="create" onClose={() => setAdding(false)} /> : null}
        </ul>
      )}

      {canManage && !adding ? (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border bg-card/50 px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          New template
        </button>
      ) : null}
    </div>
  );
}

function TemplateRow({
  template,
  canManage,
  onEdit,
}: {
  template: Template;
  canManage: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const channelIcon =
    template.channel === MessageChannel.EMAIL ? (
      <Mail className="h-3.5 w-3.5" />
    ) : (
      <MessageSquare className="h-3.5 w-3.5" />
    );

  function remove() {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    start(async () => {
      const res = await deleteTemplateAction(template.id);
      if (res.ok) {
        toast.success("Template deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{channelIcon}</span>
            {template.name}
            {template.isSystem ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                system
              </span>
            ) : null}
            {template.category ? (
              <span
                className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
              >
                {template.category.replace(/_/g, " ")}
              </span>
            ) : null}
          </p>
          {template.subject ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              <span className="font-mono uppercase tracking-wider">Subject ·</span>{" "}
              {template.subject}
            </p>
          ) : null}
          <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
            {stripHtml(template.content)}
          </p>
          {template.variables.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-1">
              {template.variables.slice(0, 6).map((v) => (
                <code
                  key={v}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {`{{${v}}}`}
                </code>
              ))}
              {template.variables.length > 6 ? (
                <span className="font-mono text-[9px] text-muted-foreground">
                  +{template.variables.length - 6}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {formatRelative(template.updatedAt)}
          </p>
          {canManage ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Edit"
              >
                <Pencil className="h-3 w-3" />
              </button>
              {!template.isSystem ? (
                <button
                  onClick={remove}
                  disabled={pending}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function TemplateForm({
  mode,
  template,
  onClose,
}: {
  mode: "create" | "edit";
  template?: Template;
  onClose: () => void;
}) {
  const router = useRouter();
  const [submitting, start] = useTransition();
  const [name, setName] = useState(template?.name ?? "");
  const [channel, setChannel] = useState<MessageChannel>(
    template?.channel ?? MessageChannel.EMAIL,
  );
  const [category, setCategory] = useState(template?.category ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [content, setContent] = useState(template?.content ?? "");

  function submit() {
    const payload = {
      name: name.trim(),
      channel,
      category: category.trim() || undefined,
      subject: channel === MessageChannel.EMAIL ? subject.trim() : undefined,
      content: content.trim(),
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createTemplateAction(payload)
          : await updateTemplateAction(template!.id, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Template created" : "Template saved");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function insertToken(tok: string) {
    setContent((prev) => prev + `{{${tok}}}`);
  }

  return (
    <li className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {mode === "create" ? "New template" : "Edit template"}
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-2.5">
          <input
            autoFocus
            placeholder="Template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as MessageChannel)}
              className="h-10 rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={MessageChannel.EMAIL}>Email</option>
              <option value={MessageChannel.SMS}>SMS</option>
            </select>
            <input
              placeholder="Category (optional, e.g. winback)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {channel === MessageChannel.EMAIL ? (
            <input
              placeholder="Subject"
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
                ? "HTML body. Use {{firstName}}, {{reservationDate}}, etc."
                : "Plain-text SMS. Use {{firstName}} etc. Keep it under 160 chars."
            }
            className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || !content.trim() || submitting}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
              (!name.trim() || !content.trim() || submitting) && "opacity-50",
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "create" ? "Create template" : "Save changes"}
          </button>
        </div>

        <aside className="rounded-md border border-dashed border-border bg-card p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Tokens — click to insert
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {TOKEN_REFERENCE.map((tok) => (
              <button
                key={tok}
                type="button"
                onClick={() => insertToken(tok)}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {`{{${tok}}}`}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </li>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
