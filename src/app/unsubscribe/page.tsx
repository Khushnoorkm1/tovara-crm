import { CheckCircle2, XCircle, Mail } from "lucide-react";
import {
  verifyUnsubscribeToken,
  processUnsubscribe,
} from "@/server/services/unsubscribe.service";
import { prisma } from "@/server/db";

export const metadata = { title: "Unsubscribe" };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; campaign?: string }>;
}) {
  const { token, campaign } = await searchParams;

  if (!token) return <Frame state="invalid" />;

  const verified = await verifyUnsubscribeToken(token);
  if (!verified) return <Frame state="invalid" />;

  const [tenant, result] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: verified.tenantId },
      select: { name: true, primaryColor: true },
    }),
    processUnsubscribe({
      guestId: verified.guestId,
      tenantId: verified.tenantId,
      campaignId: campaign,
    }),
  ]);

  return (
    <Frame
      state={result.alreadyOptedOut ? "already" : "success"}
      tenantName={tenant?.name ?? "this restaurant"}
      primaryColor={tenant?.primaryColor ?? null}
    />
  );
}

function Frame({
  state,
  tenantName,
  primaryColor,
}: {
  state: "success" | "already" | "invalid";
  tenantName?: string;
  primaryColor?: string | null;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4 py-16"
      style={primaryColor ? ({ "--brand": primaryColor } as React.CSSProperties) : undefined}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          {state === "success" ? (
            <CheckCircle2 className="h-7 w-7 text-success" />
          ) : state === "already" ? (
            <Mail className="h-7 w-7 text-muted-foreground" />
          ) : (
            <XCircle className="h-7 w-7 text-destructive" />
          )}
        </div>

        <h1 className="mt-6 font-display text-3xl tracking-tight">
          {state === "success" && "You're unsubscribed"}
          {state === "already" && "Already unsubscribed"}
          {state === "invalid" && "Couldn't unsubscribe"}
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          {state === "success" && (
            <>
              We won't send you any more marketing emails from{" "}
              <span className="font-medium text-foreground">{tenantName}</span>.
              Transactional emails about reservations you've made will still go through.
            </>
          )}
          {state === "already" && (
            <>You were already opted out of marketing from {tenantName}. No further action needed.</>
          )}
          {state === "invalid" && (
            <>
              The link is invalid or expired. If you're still receiving emails, reply to one of
              them and we'll take care of it.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
