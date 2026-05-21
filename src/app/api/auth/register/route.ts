import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/server/db";
import { registerSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, email, password, restaurantName, slug, contactEmail } = parsed.data;

  // Check slug availability up-front so we can return a precise error
  const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
  if (existingSlug) {
    return NextResponse.json(
      { error: "This subdomain is already taken", field: "slug" },
      { status: 409 },
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: restaurantName,
          contactEmail: contactEmail || email,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name,
          hashedPassword,
          role: UserRole.OWNER,
          emailVerified: new Date(), // skip verification for now (Phase 1)
        },
      });

      // Sensible defaults for the owner so the dashboard isn't empty
      await tx.reservationSettings.create({ data: { tenantId: tenant.id } });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: "tenant.created",
          entityType: "Tenant",
          entityId: tenant.id,
          changes: { after: { name: tenant.name, slug: tenant.slug } },
        },
      });

      return { tenant, user };
    });

    return NextResponse.json({
      ok: true,
      tenant: { id: result.tenant.id, slug: result.tenant.slug, name: result.tenant.name },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Race: tenant slug or (tenantId,email) unique violation
      return NextResponse.json(
        { error: "An account with that email or subdomain already exists" },
        { status: 409 },
      );
    }
    console.error("[register] failed:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
