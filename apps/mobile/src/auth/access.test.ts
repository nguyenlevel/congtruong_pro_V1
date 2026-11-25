import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SecureStoreApi } from './chunked-secure-storage';
import { clearAccessSnapshot, isNetworkError, loadAccessSnapshot, resolveAccess } from './access';
import type { TenantMembership } from './memberships';

const USER = 'user-1';
const TENANT_A = 'd44c72ee-0000-4000-8000-00000000000a';
const TENANT_B = 'd44c72ee-0000-4000-8000-00000000000b';
const TENANTS: TenantMembership[] = [
  { tenantId: TENANT_A, name: 'A', role: 'SITE_MANAGER' },
  { tenantId: TENANT_B, name: 'B', role: 'WORKER' },
];

function memoryStore(): SecureStoreApi & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (key) => data.get(key) ?? null,
    setItemAsync: async (key, value) => {
      data.set(key, value);
    },
    deleteItemAsync: async (key) => {
      data.delete(key);
    },
  };
}

const client = {} as SupabaseClient;

describe('resolveAccess', () => {
  it('uses the database answer online and keeps a device copy for offline starts', async () => {
    const storage = memoryStore();
    const result = await resolveAccess({
      client,
      storage,
      userId: USER,
      isOnline: async () => true,
      now: () => 7,
      fetchTenants: async () => TENANTS,
      fetchActiveTenant: async () => TENANT_A,
    });

    expect(result).toMatchObject({ status: 'ready', source: 'server', offline: false, activeTenantId: TENANT_A });
    expect(await loadAccessSnapshot(storage, USER)).toMatchObject({ activeTenantId: TENANT_A, savedAt: 7 });
  });

  it('opens from the device copy when the device is offline (cold start without network)', async () => {
    const storage = memoryStore();
    await resolveAccess({
      client, storage, userId: USER, isOnline: async () => true,
      fetchTenants: async () => TENANTS, fetchActiveTenant: async () => TENANT_A,
    });
    const fetchTenants = vi.fn();

    const result = await resolveAccess({
      client, storage, userId: USER, isOnline: async () => false, fetchTenants,
    });

    expect(result).toMatchObject({ status: 'ready', source: 'snapshot', offline: true, activeTenantId: TENANT_A });
    expect(fetchTenants).not.toHaveBeenCalled();
  });

  it('falls back to the device copy when the request fails because of the network', async () => {
    const storage = memoryStore();
    await resolveAccess({
      client, storage, userId: USER, isOnline: async () => true,
      fetchTenants: async () => TENANTS, fetchActiveTenant: async () => TENANT_A,
    });

    const result = await resolveAccess({
      client, storage, userId: USER, isOnline: async () => true,
      fetchTenants: async () => {
        throw new TypeError('Network request failed');
      },
      fetchActiveTenant: async () => TENANT_A,
    });

    expect(result).toMatchObject({ status: 'ready', source: 'snapshot', offline: true });
  });

  it('asks for a first online sign-in when there is no device copy', async () => {
    const result = await resolveAccess({ client, storage: memoryStore(), userId: USER, isOnline: async () => false });
    expect(result.status).toBe('unavailable');
  });

  it('denies access and deletes the device copy when the database no longer lists the tenant', async () => {
    const storage = memoryStore();
    await resolveAccess({
      client, storage, userId: USER, isOnline: async () => true,
      fetchTenants: async () => TENANTS, fetchActiveTenant: async () => TENANT_A,
    });

    const result = await resolveAccess({
      client, storage, userId: USER, isOnline: async () => true,
      fetchTenants: async () => [TENANTS[1]!],
      fetchActiveTenant: async () => TENANT_A,
    });

    expect(result.status).toBe('denied');
    expect(await loadAccessSnapshot(storage, USER)).toBeNull();
  });

  it('does not treat a database rejection as a network failure', async () => {
    const storage = memoryStore();
    await resolveAccess({
      client, storage, userId: USER, isOnline: async () => true,
      fetchTenants: async () => TENANTS, fetchActiveTenant: async () => TENANT_A,
    });

    const result = await resolveAccess({
      client, storage, userId: USER, isOnline: async () => true,
      fetchTenants: async () => {
        throw new Error('permission denied for table memberships');
      },
      fetchActiveTenant: async () => TENANT_A,
    });

    expect(result).toMatchObject({ status: 'denied' });
  });

  it('ignores a device copy that belongs to another user', async () => {
    const storage = memoryStore();
    storage.data.set('access.snapshot.user-2', JSON.stringify({ userId: 'user-1', tenants: TENANTS, activeTenantId: TENANT_A, savedAt: 1 }));
    expect(await loadAccessSnapshot(storage, 'user-2')).toBeNull();
    await clearAccessSnapshot(storage, 'user-2');
    expect(storage.data.size).toBe(0);
  });
});

describe('isNetworkError', () => {
  it('recognises connectivity failures only', () => {
    expect(isNetworkError(new TypeError('x'))).toBe(true);
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
    expect(isNetworkError(new Error('permission denied'))).toBe(false);
  });
});
