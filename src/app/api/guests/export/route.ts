import { requireAuth, AuthError } from "@/server/tenant";
import { exportGuestsCsv } from "@/server/services/guest.service";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const csv = await exportGuestsCsv(ctx);
    const today = new Date().toISOString().split("T")[0];
    const filename = `guests-${today}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(err.message, { status: err.status });
    }
    console.error("[guests export] error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
