import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { getGuestById } from "@/server/services/guest.service";
import { GuestForm } from "@/components/guests/guest-form";
import { GuestDeleteButton } from "@/components/guests/guest-delete-button";

export const metadata = { title: "Edit guest" };

export default async function EditGuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "guest.update")) redirect("/guests");

  const { id } = await params;
  const guest = await getGuestById(ctx, id);
  if (!guest) notFound();

  const initialValues = {
    firstName: guest.firstName,
    lastName: guest.lastName ?? "",
    email: guest.email ?? "",
    phone: guest.phone ?? "",
    dateOfBirth: guest.dateOfBirth
      ? guest.dateOfBirth.toISOString().split("T")[0]!
      : "",
    addressLine1: guest.addressLine1 ?? "",
    city: guest.city ?? "",
    state: guest.state ?? "",
    postalCode: guest.postalCode ?? "",
    vipStatus: guest.vipStatus,
    dietaryRestrictions: guest.dietaryRestrictions,
    allergies: guest.allergies,
    favoriteSeating: guest.favoriteSeating ?? "",
    marketingEmailOptIn: guest.marketingEmailOptIn,
    marketingSmsOptIn: guest.marketingSmsOptIn,
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <Link
        href={`/guests/${guest.id}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to profile
      </Link>

      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Edit profile
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">
          {guest.firstName} {guest.lastName ?? ""}
        </h1>
      </div>

      <div className="mt-10">
        <GuestForm mode="edit" guestId={guest.id} initialValues={initialValues} />
      </div>

      {hasPermission(ctx.role, "guest.delete") ? (
        <div className="mt-12 rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-destructive">
            Danger zone
          </p>
          <p className="mt-2 text-sm">
            Deleting removes this guest's profile and all their notes. Reservation history is preserved (orphaned with the saved name on each booking).
          </p>
          <div className="mt-3">
            <GuestDeleteButton guestId={guest.id} guestName={`${guest.firstName} ${guest.lastName ?? ""}`} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
