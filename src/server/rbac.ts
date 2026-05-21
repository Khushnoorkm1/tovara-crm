import { UserRole } from "@prisma/client";

/**
 * Permission strings: "resource.action".
 * Add new permissions here, then grant them to roles below.
 */
export const PERMISSIONS = {
  // Tenant settings
  "tenant.view": "View tenant settings",
  "tenant.update": "Update tenant settings",
  "tenant.billing.view": "View billing",
  "tenant.billing.manage": "Manage billing",

  // Users / team
  "user.view": "View team members",
  "user.invite": "Invite team members",
  "user.update": "Update team members",
  "user.delete": "Remove team members",

  // Tables / floor plan
  "table.view": "View tables",
  "table.manage": "Manage tables and floor plan",

  // Reservations
  "reservation.view": "View reservations",
  "reservation.create": "Create reservations",
  "reservation.update": "Update reservations",
  "reservation.cancel": "Cancel reservations",
  "reservation.seat": "Seat / mark no-show",

  // Waitlist
  "waitlist.manage": "Manage waitlist",

  // Guests / CRM
  "guest.view": "View guests",
  "guest.create": "Create guests",
  "guest.update": "Update guests",
  "guest.delete": "Delete guests",
  "guest.export": "Export guests",
  "guest.note.create": "Add guest notes",
  "guest.tag.manage": "Manage guest tags",

  // Loyalty
  "loyalty.view": "View loyalty program",
  "loyalty.manage": "Manage loyalty program",

  // Marketing
  "marketing.view": "View campaigns and segments",
  "marketing.manage": "Create / send campaigns",

  // Analytics
  "analytics.view": "View analytics",

  // Audit
  "audit.view": "View audit log",

  // Integrations
  "integration.manage": "Manage integrations",
  "apikey.manage": "Manage API keys",
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ---------------------------------------------------------------------
// Role → permissions matrix
// ---------------------------------------------------------------------

const STAFF_PERMS: Permission[] = [
  "reservation.view",
  "reservation.seat",
  "guest.view",
  "guest.note.create",
  "waitlist.manage",
];

const HOST_PERMS: Permission[] = [
  ...STAFF_PERMS,
  "reservation.create",
  "reservation.update",
  "reservation.cancel",
  "guest.create",
  "guest.update",
  "guest.tag.manage",
  "table.view",
];

const MANAGER_PERMS: Permission[] = [
  ...HOST_PERMS,
  "table.manage",
  "guest.export",
  "loyalty.view",
  "marketing.view",
  "analytics.view",
  "user.view",
  "tenant.view",
];

const ADMIN_PERMS: Permission[] = [
  ...MANAGER_PERMS,
  "guest.delete",
  "user.invite",
  "user.update",
  "loyalty.manage",
  "marketing.manage",
  "tenant.update",
  "audit.view",
  "integration.manage",
];

const OWNER_PERMS: Permission[] = [
  ...ADMIN_PERMS,
  "user.delete",
  "tenant.billing.view",
  "tenant.billing.manage",
  "apikey.manage",
];

const ALL_PERMS = Object.keys(PERMISSIONS) as Permission[];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMS,
  OWNER: OWNER_PERMS,
  ADMIN: ADMIN_PERMS,
  MANAGER: MANAGER_PERMS,
  HOST: HOST_PERMS,
  STAFF: STAFF_PERMS,
};

/**
 * Returns true if the role grants the given permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Returns true if the role grants ALL listed permissions.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Returns true if the role grants ANY of the listed permissions.
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * All permissions granted to a role (useful to send to the client once at login).
 */
export function permissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}
