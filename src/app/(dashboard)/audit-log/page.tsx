import { requireAuthOrRedirect } from "@/server/tenant";
import { listAuditLogs } from "@/server/services/audit.service";
import { hasPermission } from "@/server/rbac";
import { redirect } from "next/navigation";
import { formatDateTime, formatRelative, initials } from "@/lib/format";
import { ScrollText } from "lucide-react";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "audit.view")) redirect("/dashboard");

  const sp = await searchParams;
  const page = Number(sp.page ?? 1);

  const { items, total, totalPages } = await listAuditLogs({ ctx, page, pageSize: 50 });

  return (
    <div className="mx-auto max-w-[1100px] animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Compliance · Read-only
          </p>
          <h1 className="mt-3 text-4xl tracking-tight">Audit log</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Every change made to your tenant — who did it, when, and what was modified.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {total.toLocaleString()} entries
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border p-16 text-center">
          <ScrollText className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">No audit entries yet.</p>
        </div>
      ) : (
        <>
          <div className="mt-10 overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Changes</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                    <Td>
                      <div className="text-xs">
                        <p className="font-medium text-foreground">
                          {formatRelative(entry.createdAt)}
                        </p>
                        <p className="text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                      </div>
                    </Td>
                    <Td>
                      {entry.user ? (
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">
                            {initials(entry.user.name ?? entry.user.email)}
                          </span>
                          <div className="text-xs">
                            <p className="font-medium">{entry.user.name ?? entry.user.email}</p>
                            <p className="text-muted-foreground">{entry.user.email}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">system</span>
                      )}
                    </Td>
                    <Td>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        {entry.action}
                      </code>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        <p className="font-medium">{entry.entityType}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {entry.entityId.slice(0, 12)}…
                        </p>
                      </div>
                    </Td>
                    <Td>
                      {entry.changes ? (
                        <details className="cursor-pointer">
                          <summary className="text-xs text-muted-foreground hover:text-foreground">
                            View
                          </summary>
                          <pre className="mt-2 max-w-md overflow-x-auto rounded bg-muted p-2 font-mono text-[10px] leading-relaxed">
                            {JSON.stringify(entry.changes, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} />
          ) : null}
        </>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <nav className="mt-6 flex items-center justify-between">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <a
            href={`?page=${page - 1}`}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            ← Previous
          </a>
        ) : null}
        {page < totalPages ? (
          <a
            href={`?page=${page + 1}`}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Next →
          </a>
        ) : null}
      </div>
    </nav>
  );
}
