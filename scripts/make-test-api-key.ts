import { createApiKey } from "../src/server/services/api-key.service";
import { prisma, tenantDb } from "../src/server/db";
import type { UserRole } from "@prisma/client";

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "marios-bistro" } });
  if (!tenant) throw new Error("Tenant marios-bistro not found");
  const owner = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "OWNER" },
  });
  if (!owner) throw new Error("Owner user not found");

  const ctx = {
    userId: owner.id,
    tenantId: tenant.id,
    role: "OWNER" as UserRole,
    email: owner.email,
    name: owner.name,
    db: tenantDb(tenant.id),
  };
  const k = await createApiKey(ctx, {
    name: "Smoke test key",
    scopes: ["reservation:read", "reservation:write", "guest:read", "guest:write", "table:read"],
  });
  console.log("KEY=" + k.plaintext);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
