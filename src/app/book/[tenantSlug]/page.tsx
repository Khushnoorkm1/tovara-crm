import { notFound } from "next/navigation";
import { getPublicTenant } from "@/server/services/public-booking.service";
import { BookingFlow } from "@/components/public-booking/booking-flow";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getPublicTenant(tenantSlug);
  if (!tenant) return { title: "Restaurant not found" };
  return {
    title: `Book a table at ${tenant.name}`,
    description: `Reserve a table at ${tenant.name}${tenant.city ? ` in ${tenant.city}` : ""}.`,
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getPublicTenant(tenantSlug);
  if (!tenant) notFound();

  // Default the search to today + party of 2
  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return (
    <BookingFlow
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      address={[tenant.addressLine1, tenant.city, tenant.state].filter(Boolean).join(", ")}
      maxPartySize={tenant.reservationSettings?.maxPartySize ?? 12}
      largePartyThreshold={tenant.reservationSettings?.largePartyThreshold ?? 8}
      advanceBookingDays={tenant.reservationSettings?.advanceBookingDays ?? 60}
      defaultDate={defaultDate}
    />
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
