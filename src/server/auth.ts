import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";

// ---------------------------------------------------------------------
// Type augmentation: stuff our session/JWT carry beyond the defaults
// ---------------------------------------------------------------------
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string | null;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId?: string | null;
    role?: UserRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    tenantId: string | null;
    role: UserRole;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(), // optional: when login form is bound to a tenant subdomain
});

const isGoogleConfigured = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" }, // required for credentials provider
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(isGoogleConfigured
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tenantSlug: { label: "Tenant", type: "text" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password, tenantSlug } = parsed.data;

        // Resolve the user record. If a tenant slug is provided we scope the
        // lookup; otherwise we look up by email globally and refuse to guess
        // when the same email exists in multiple tenants (rare but possible).
        let user;
        if (tenantSlug) {
          const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
          if (!tenant || !tenant.isActive) return null;
          user = await prisma.user.findUnique({
            where: { tenantId_email: { tenantId: tenant.id, email } },
          });
        } else {
          const matches = await prisma.user.findMany({
            where: { email },
            take: 2,
          });
          if (matches.length !== 1) return null; // 0 = no user; 2+ = ambiguous, require tenant slug
          user = matches[0];
        }

        if (!user || !user.hashedPassword || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) return null;

        // Update lastLoginAt fire-and-forget
        prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => null);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // First sign-in: copy user fields into the JWT
      if (user) {
        token.userId = user.id!;
        token.tenantId = user.tenantId ?? null;
        token.role = user.role ?? UserRole.STAFF;
      }

      // For Google sign-in: look up the linked user record to enrich the token
      if (trigger === "signIn" && !token.role && token.email) {
        const dbUser = await prisma.user.findFirst({
          where: { email: token.email as string },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.tenantId = dbUser.tenantId;
          token.role = dbUser.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.tenantId = token.tenantId;
      session.user.role = token.role;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        await prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => null);
      }
    },
  },
  trustHost: true,
});
