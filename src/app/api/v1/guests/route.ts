import { authenticateApiRequest, okResponse, errResponse, parsePaging } from "@/server/api-auth";
import { apiCreateGuestSchema } from "@/lib/validators/integrations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req, "guest:read");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { page, pageSize, skip } = parsePaging(req);

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const where = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    ctx.db.guest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        vipStatus: true,
        totalVisits: true,
        totalSpend: true,
        lastVisitAt: true,
        marketingEmailOptIn: true,
        marketingSmsOptIn: true,
        createdAt: true,
      },
    }),
    ctx.db.guest.count({ where }),
  ]);

  return okResponse({
    items: items.map((g) => ({
      ...g,
      lastVisitAt: g.lastVisitAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    hasMore: skip + items.length < total,
  });
}

export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req, "guest:write");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errResponse(400, "invalid_json", "Body must be valid JSON");
  }
  const parsed = apiCreateGuestSchema.safeParse(body);
  if (!parsed.success) {
    return errResponse(400, "invalid_body", parsed.error.errors[0]?.message ?? "Invalid");
  }
  const input = parsed.data;

  // Dedupe — if a guest with this email or phone already exists, return it
  if (input.email || input.phone) {
    const existing = await ctx.db.guest.findFirst({
      where: {
        OR: [
          input.email ? { email: input.email } : { id: "_" },
          input.phone ? { phone: input.phone } : { id: "_" },
        ],
      },
    });
    if (existing) {
      return okResponse({ ...existing, _existing: true }, { status: 200 });
    }
  }

  const guest = await ctx.db.guest.create({
    data: {
      tenantId: ctx.tenantId,
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      marketingEmailOptIn: input.marketingEmailOptIn ?? false,
    },
  });

  (async () => {
    try {
      const { fireWebhookEvent } = await import("@/server/services/webhook.service");
      await fireWebhookEvent({
        tenantId: ctx.tenantId,
        event: "guest.created",
        payload: { guestId: guest.id, firstName: guest.firstName, email: guest.email },
      });
    } catch (err) {
      console.error("[api] guest.created webhook failed:", err);
    }
  })();

  return okResponse(guest, { status: 201 });
}
