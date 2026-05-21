import { NextResponse, type NextRequest } from "next/server";
import { extractSubdomain } from "@/lib/subdomain";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/reservations",
  "/waitlist",
  "/guests",
  "/loyalty",
  "/marketing",
  "/analytics",
  "/audit-log",
  "/settings",
];

const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

const PUBLIC_ROUTES = ["/", "/book"];

/**
 * Auth.js v5 stores its session in a cookie. We can detect "logged in" purely
 * by the presence of the session cookie — Edge runtime can't import the full
 * auth() helper. We just need a fast yes/no for redirect logic.
 */
function hasSessionCookie(req: NextRequest): boolean {
  const isSecure = req.nextUrl.protocol === "https:";
  const cookieName = isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";
  return Boolean(req.cookies.get(cookieName)?.value);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  // Pass tenant slug forward as a header for server components / layouts
  const subdomain = extractSubdomain(host);
  const requestHeaders = new Headers(req.headers);
  if (subdomain) requestHeaders.set("x-tenant-slug", subdomain);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_ROUTES.some((p) => pathname === p);
  const loggedIn = hasSessionCookie(req);

  // 1. Block access to /dashboard etc. when not logged in
  if (isProtected && !loggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Bounce already-logged-in users away from /login & /register
  if (isAuthPage && loggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Skip static assets, _next, image optimization, favicon, and Auth.js's own routes
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
