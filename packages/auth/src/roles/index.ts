/**
 * Static, fixed roles used across the whole system (Web + Mobile + RLS).
 * Never hardcode these strings anywhere else.
 */
export const USER_ROLES = [
  'SYS_ADMIN',
  'PROJECT_VIEWER',
  'PROJECT_MANAGER',
  'SITE_MANAGER',
  'SUB_CONTRACTOR',
  'WORKER',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
