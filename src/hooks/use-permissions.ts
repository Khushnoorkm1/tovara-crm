"use client";

import { useSession } from "next-auth/react";
import { hasPermission, type Permission } from "@/server/rbac";
import { UserRole } from "@prisma/client";

export function usePermissions() {
  const { data: session, status } = useSession();
  const role = session?.user?.role ?? UserRole.STAFF;

  return {
    isAuthenticated: status === "authenticated",
    role,
    can: (permission: Permission) => hasPermission(role, permission),
  };
}
