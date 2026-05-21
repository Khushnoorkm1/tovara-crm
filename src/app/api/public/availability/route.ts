import { NextResponse } from "next/server";
import { publicAvailabilityQuerySchema } from "@/lib/validators/public-booking";
import { getPublicAvailability } from "@/server/services/public-booking.service";
import { checkRateLimit, keyFromRequest, rateLimitedResponse } from "@/server/rate-limit";

const LIMIT = { limit: 30, windowMs: 60_000 };

export async function GET(request: Request) {
  const rl = checkRateLimit(keyFromRequest(request), LIMIT);
  if (!rl.allowed) return rateLimitedResponse(rl);

  const { searchParams } = new URL(request.url);
  const parsed = publicAvailabilityQuerySchema.safeParse({
    tenantSlug: searchParams.get("tenantSlug"),
    date: searchParams.get("date"),
    partySize: searchParams.get("partySize"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }
  try {
    const result = await getPublicAvailability(parsed.data);
    if (result.tenantNotFound) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[public availability] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
