import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow server actions on subdomains (multi-tenant)
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "*.localhost:3000",
        process.env.NEXT_PUBLIC_APP_DOMAIN ?? "",
        `*.${process.env.NEXT_PUBLIC_APP_DOMAIN ?? ""}`,
      ].filter(Boolean),
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
