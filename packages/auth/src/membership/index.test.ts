import { describe, expect, it } from 'vitest';
import { resolveMembership } from './index';

const member = { user_id: 'user', tenant_id: 'tenant', role: 'SITE_MANAGER' };
const claims = { sub: 'user', tenant_id: 'tenant', app_role: 'SITE_MANAGER' };

describe('resolveMembership', () => {
  it('accepts a single membership matching authenticated token claims', () => {
    expect(resolveMembership('user', [member], claims)).toEqual({
      userId: 'user',
      tenantId: 'tenant',
      role: 'SITE_MANAGER',
      tenants: [{ tenantId: 'tenant', role: 'SITE_MANAGER' }],
    });
  });

  it('selects the tenant matching the claim among several memberships', () => {
    const other = { user_id: 'user', tenant_id: 'tenant-2', role: 'WORKER' };
    const resolved = resolveMembership('user', [member, other], {
      ...claims,
      tenant_id: 'tenant-2',
      app_role: 'WORKER',
    });
    expect(resolved.tenantId).toBe('tenant-2');
    expect(resolved.tenants).toHaveLength(2);
  });

  it('rejects absent memberships', () => {
    expect(() => resolveMembership('user', [], claims)).toThrow();
  });

  it('rejects a claim tenant that is no longer a live membership (revoked)', () => {
    expect(() => resolveMembership('user', [member], { ...claims, tenant_id: 'other' })).toThrow();
  });

  it('rejects a stale role claim and unknown roles', () => {
    expect(() => resolveMembership('user', [member], { ...claims, app_role: 'WORKER' })).toThrow();
    expect(() =>
      resolveMembership('user', [{ ...member, role: 'UNKNOWN' }], {
        ...claims,
        app_role: 'UNKNOWN',
      }),
    ).toThrow();
  });
});
