"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { PaymentStatus } from "@prisma/client";
import { refundDepositAction } from "@/server/actions/integrations.actions";
import { formatCurrency, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  amount: number;
  status: PaymentStatus;
  refundedAmount: number | null;
  authorizedAt: string | null;
  refundedAt: string | null;
  receiptUrl: string | null;
};

const STATUS_TONES: Record<PaymentStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  AUTHORIZED: "bg-success/15 text-success ring-success/30",
  REFUNDED: "bg-muted text-muted-foreground",
  PARTIAL_REFUND: "bg-warning/15 text-warning ring-warning/30",
  FAILED: "bg-destructive/15 text-destructive ring-destructive/30",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function PaymentStatusCard({
  reservationId,
  payment,
  canRefund,
}: {
  reservationId: string;
  payment: PaymentRow;
  canRefund: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function refund() {
    if (
      !confirm(
        `Refund the full ${formatCurrency(payment.amount)} deposit? This goes through Stripe immediately.`,
      )
    )
      return;
    start(async () => {
      const res = await refundDepositAction(reservationId);
      if (res.ok) {
        toast.success("Deposit refunded");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            Deposit
          </p>
          <p className="mt-2 font-display text-2xl tabular-nums">
            {formatCurrency(payment.amount)}
          </p>
          {payment.refundedAmount && payment.refundedAmount > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatCurrency(payment.refundedAmount)} refunded
            </p>
          ) : null}
          <span
            className={cn(
              "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ring-1 ring-border",
              STATUS_TONES[payment.status],
            )}
          >
            {payment.status === "AUTHORIZED" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : payment.status === "FAILED" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : null}
            {payment.status.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>

        <div className="text-right">
          {payment.authorizedAt ? (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Charged {formatRelative(payment.authorizedAt)}
            </p>
          ) : null}
          {payment.refundedAt ? (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Refunded {formatRelative(payment.refundedAt)}
            </p>
          ) : null}
          {payment.receiptUrl ? (
            <a
              href={payment.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
            >
              View receipt →
            </a>
          ) : null}
        </div>
      </div>

      {payment.status === PaymentStatus.AUTHORIZED && canRefund ? (
        <div className="mt-4 border-t border-border pt-3">
          <button
            onClick={refund}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs transition hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refund deposit
          </button>
        </div>
      ) : null}
    </section>
  );
}
