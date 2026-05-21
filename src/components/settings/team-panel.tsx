"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Power, PowerOff } from "lucide-react";
import { UserRole } from "@prisma/client";
import {
  updateUserRoleAction,
  deactivateUserAction,
  reactivateUserAction,
} from "@/server/actions/settings.actions";
import { formatRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type TeamUser = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLE_OPTIONS: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "HOST", "STAFF"];

export function TeamPanel({
  users,
  currentUserId,
  currentRole,
}: {
  users: TeamUser[];
  currentUserId: string;
  currentRole: UserRole;
}) {
  return (
    <ul className="space-y-2">
      {users.map((u) => (
        <UserRow
          key={u.id}
          user={u}
          isMe={u.id === currentUserId}
          currentRole={currentRole}
        />
      ))}
    </ul>
  );
}

function UserRow({
  user,
  isMe,
  currentRole,
}: {
  user: TeamUser;
  isMe: boolean;
  currentRole: UserRole;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const canEdit = ["OWNER", "ADMIN"].includes(currentRole) && !isMe;
  // Only an owner can edit/deactivate another owner
  const lockedByRole = user.role === "OWNER" && currentRole !== "OWNER";

  function changeRole(role: UserRole) {
    if (role === user.role) return;
    start(async () => {
      const res = await updateUserRoleAction({ userId: user.id, role });
      if (res.ok) {
        toast.success("Role updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function toggleActive() {
    start(async () => {
      const res = user.isActive
        ? await deactivateUserAction(user.id)
        : await reactivateUserAction(user.id);
      if (res.ok) {
        toast.success(user.isActive ? "User deactivated" : "User reactivated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-lg border border-border bg-card p-4",
        !user.isActive && "opacity-60",
      )}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">
        {initials(user.name ?? user.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {user.name ?? user.email}
          {isMe ? (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              you
            </span>
          ) : null}
          {!user.isActive ? (
            <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-destructive">
              deactivated
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {user.lastLoginAt
            ? `Last login ${formatRelative(user.lastLoginAt)}`
            : `Joined ${formatRelative(user.createdAt)}`}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        {canEdit && !lockedByRole ? (
          <select
            value={user.role}
            onChange={(e) => changeRole(e.target.value as UserRole)}
            disabled={pending}
            className="h-8 rounded-md border border-input bg-card px-2 font-mono text-[10px] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r} disabled={r === "OWNER" && currentRole !== "OWNER"}>
                {r.toLowerCase()}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {user.role.toLowerCase()}
          </span>
        )}
        {canEdit && !lockedByRole ? (
          <button
            onClick={toggleActive}
            disabled={pending}
            className="inline-flex h-7 items-center gap-1 rounded px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : user.isActive ? (
              <>
                <PowerOff className="h-3 w-3" />
                Deactivate
              </>
            ) : (
              <>
                <Power className="h-3 w-3" />
                Reactivate
              </>
            )}
          </button>
        ) : null}
      </div>
    </li>
  );
}
