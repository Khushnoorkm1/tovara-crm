export const APP_NAME = "Tavola";
export const APP_TAGLINE = "Reservations & guest CRM, refined.";

export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
];

export const PROTECTED_PATH_PREFIX = ["/dashboard", "/reservations", "/guests", "/audit-log", "/settings", "/loyalty", "/marketing", "/analytics", "/waitlist"];

export const RESERVED_TENANT_SLUGS = new Set([
  "www", "api", "admin", "app", "auth", "dashboard", "login", "register",
  "support", "help", "blog", "status",
]);
