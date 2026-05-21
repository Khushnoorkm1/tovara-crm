import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/server/tenant";
import { availabilityQuerySchema } from "@/lib/validators/reservation";
import { getAvailability } from "@/server/services/availability.service";

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(request.url);
    const parsed = availabilityQuerySchema.safeParse({
      date: searchParams.get("date"),
      partySize: searchParams.get("partySize"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }
    const result = await getAvailability({ db: ctx.db, ...parsed.data });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[availability] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
