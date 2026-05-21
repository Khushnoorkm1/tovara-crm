"use client";

import { useSession } from "next-auth/react";

export function useTenant() {
  const { data: session, status } = useSession();
  return {
    tenantId: session?.user?.tenantId ?? null,
    user: session?.user ?? null,
    isLoading: status === "loading",
  };
}
