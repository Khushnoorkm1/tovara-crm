import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicTenant } from "@/server/services/public-booking.service";
import { APP_NAME } from "@/lib/constants";

export default async function BookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getPublicTenant(tenantSlug);
  if (!tenant) notFound();

  // Derive a CSS-friendly accent from the tenant's brand color. We attach it
  // as a CSS custom property on the wrapper so children can use it via
  // `bg-[var(--brand)]`, `text-[var(--brand)]`, etc.
  const styleVars = {
    ["--brand" as string]: tenant.primaryColor,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen bg-grain"
      style={{ ...styleVars, backgroundColor: "hsl(var(--background))" }}
    >
      {/* Branded header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: "var(--brand)" }}
              aria-hidden
            >
              <span className="font-display text-base">
                {tenant.name[0]?.toUpperCase()}
              </span>
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg tracking-tight">{tenant.name}</span>
              {tenant.cuisineType ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {tenant.cuisineType}
                  {tenant.priceRange ? ` · ${"$".repeat(tenant.priceRange)}` : ""}
                </span>
              ) : null}
            </div>
          </div>

          {tenant.websiteUrl ? (
            <a
              href={tenant.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs text-muted-foreground hover:text-foreground sm:inline-block"
            >
              Visit website ↗
            </a>
          ) : null}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-10 lg:py-16">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 text-xs text-muted-foreground">
          <p>
            {tenant.contactPhone ? (
              <a href={`tel:${tenant.contactPhone}`} className="hover:text-foreground">
                {tenant.contactPhone}
              </a>
            ) : null}
            {tenant.contactPhone && (tenant.addressLine1 || tenant.city) ? " · " : ""}
            {tenant.addressLine1 ? `${tenant.addressLine1}` : ""}
            {tenant.city ? `, ${tenant.city}` : ""}
            {tenant.state ? `, ${tenant.state}` : ""}
          </p>
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.2em] hover:text-foreground"
          >
            Powered by {APP_NAME}
          </Link>
        </div>
      </footer>
    </div>
  );
}
