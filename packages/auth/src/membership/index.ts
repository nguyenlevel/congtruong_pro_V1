import { isUserRole, type UserRole } from '../roles';

export interface TenantMembership {
  tenantId: string;
  role: UserRole;
}

export interface AuthenticatedMember {
  userId: string;
  tenantId: string;
  role: UserRole;
  /** Every tenant the database says the user belongs to; used by the tenant switcher. */
  tenants: readonly TenantMembership[];
}

/**
 * Resolve the active tenant from database memberships. The JWT tenant claim is only a
 * selector: it must match one live membership, otherwise the session is refused and the
 * caller must refresh or re-select a tenant. The database remains the authority.
 */
export function resolveMembership(
  userId: string,
  memberships: readonly { user_id: string; tenant_id: string; role: string }[],
  claims: { sub?: unknown; tenant_id?: unknown; app_role?: unknown },
): AuthenticatedMember {
  const live = memberships.filter((m) => m.user_id === userId && isUserRole(m.role));
  if (live.length === 0) {
    throw new Error('Tài khoản chưa được cấp quyền vào đơn vị nào.');
  }
  const member = live.find((m) => m.tenant_id === claims.tenant_id);
  if (!member || claims.sub !== userId || claims.app_role !== member.role) {
    throw new Error('Phiên đăng nhập không còn khớp quyền hiện tại. Vui lòng đăng nhập lại.');
  }
  return {
    userId,
    tenantId: member.tenant_id,
    role: member.role as UserRole,
    tenants: live.map((m) => ({ tenantId: m.tenant_id, role: m.role as UserRole })),
  };
}
