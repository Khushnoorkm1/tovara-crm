import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getTenantFromHost } from "@/server/tenant";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const tenant = await getTenantFromHost();
  const isGoogleConfigured = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return (
    <div>
      <div className="mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {tenant ? `Sign in to ${tenant.name}` : "Welcome back"}
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">Sign in to your account</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create a restaurant account
          </Link>
        </p>
      </div>

      <Suspense fallback={null}>
        <LoginForm tenantSlug={tenant?.slug} googleEnabled={isGoogleConfigured} />
      </Suspense>
    </div>
  );
}
