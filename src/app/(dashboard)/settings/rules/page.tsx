import { redirect } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { requireAuthOrRedirect } from "@/server/tenant";
import { hasPermission } from "@/server/rbac";
import { ReservationRulesForm } from "@/components/settings/reservation-rules-form";

export const metadata = { title: "Reservation rules" };
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const ctx = await requireAuthOrRedirect();
  if (!hasPermission(ctx.role, "tenant.view")) redirect("/dashboard");

  const settings = await ctx.db.reservationSettings.findUnique({
    where: { tenantId: ctx.tenantId },
  });
  if (!settings) redirect("/onboarding");

  const canEdit = ["OWNER", "ADMIN", "MANAGER"].includes(ctx.role);

  return (
    <div className="mx-auto max-w-[900px] animate-fade-in space-y-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Configure
        </p>
        <h1 className="mt-3 flex items-center gap-3 text-4xl tracking-tight">
          Reservation rules
          <SettingsIcon className="h-7 w-7 text-primary/60" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          How booking works on the public widget. Most restaurants set these once and never touch
          them again.
        </p>
      </div>

      <ReservationRulesForm
        canEdit={canEdit}
        settings={{
          advanceBookingDays: settings.advanceBookingDays,
          minLeadTimeMinutes: settings.minLeadTimeMinutes,
          slotDurationMinutes: settings.slotDurationMinutes,
          defaultDiningDurationMin: settings.defaultDiningDurationMin,
          maxPartySize: settings.maxPartySize,
          largePartyThreshold: settings.largePartyThreshold,
          autoConfirm: settings.autoConfirm,
          allowWaitlist: settings.allowWaitlist,
          sendConfirmationEmail: settings.sendConfirmationEmail,
          sendReminderEmail: settings.sendReminderEmail,
          reminderHoursBefore: settings.reminderHoursBefore,
        }}
      />
    </div>
  );
}
