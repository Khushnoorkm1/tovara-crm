import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { GuestForm } from "@/components/guests/guest-form";

export const metadata = { title: "New guest" };

export default async function NewGuestPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "guest.create")) redirect("/guests");

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <Link
        href="/guests"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to guests
      </Link>

      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Relationships · New guest
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">Add a guest</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a profile manually. Public bookings auto-create profiles too.
        </p>
      </div>

      <div className="mt-10">
        <GuestForm mode="create" />
      </div>
    </div>
  );
}
