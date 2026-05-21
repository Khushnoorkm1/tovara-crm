import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { requireAuthOrRedirect } from "@/server/tenant";
import { prisma } from "@/server/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuthOrRedirect();

  // Look up tenant + user info for the chrome (one query, cached at the layout level)
  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true },
    }),
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, image: true, role: true },
    }),
  ]);

  if (!tenant || !user) {
    // shouldn't happen if requireAuth succeeded, but be defensive
    throw new Error("Tenant or user record missing");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar tenant={tenant} role={user.role} />
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <Topbar user={user} tenant={tenant} />
        <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
