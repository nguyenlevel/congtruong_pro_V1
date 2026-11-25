import type { UserRole } from '../roles';

/**
 * UI hints that mirror the database policies. They only decide which actions to show;
 * PostgreSQL RLS stays the authority (see migrations 004, 019, 024 and 026).
 */
const ROSTER_WRITE_ROLES: readonly UserRole[] = ['SYS_ADMIN', 'SITE_MANAGER', 'SUB_CONTRACTOR'];
const PROJECT_CREATE_ROLES: readonly UserRole[] = ['SYS_ADMIN', 'SITE_MANAGER', 'PROJECT_MANAGER'];

export function canWriteRoster(role: string | null | undefined): boolean {
  return ROSTER_WRITE_ROLES.includes(role as UserRole);
}

export function canCreateProject(role: string | null | undefined): boolean {
  return PROJECT_CREATE_ROLES.includes(role as UserRole);
}
