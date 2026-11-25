import type { SupabaseClient } from '@supabase/supabase-js';
import type { SecureStoreApi } from './chunked-secure-storage';
import { getActiveTenantId, listMyTenants, type TenantMembership } from './memberships';

/**
 * What the device may show while offline. It is a convenience copy of the last membership the
 * database confirmed for this user; it never grants anything the database has revoked, because
 * every online start replaces it with the database answer.
 */
export interface AccessSnapshot {
  userId: string;
  tenants: TenantMembership[];
  activeTenantId: string;
  savedAt: number;
}

export type AccessResult =
  | {
      status: 'ready';
      source: 'server' | 'snapshot';
      /** True when the answer comes from the device copy because the network was unavailable. */
      offline: boolean;
      tenants: TenantMembership[];
      activeTenantId: string;
    }
  | { status: 'denied'; reason: string }
  | { status: 'unavailable'; reason: string };

export interface AccessDeps {
  client: SupabaseClient;
  storage: SecureStoreApi;
  userId: string;
  isOnline(): Promise<boolean>;
  now?(): number;
  /** Test seams; default to the database readers. */
  fetchTenants?(client: SupabaseClient): Promise<TenantMembership[]>;
  fetchActiveTenant?(client: SupabaseClient): Promise<string | null>;
}

const snapshotKey = (userId: string): string => `access.snapshot.${userId}`;

const NETWORK_PATTERN = /network|fetch|timeout|timed out|offline|econn|abort|unreachable/i;

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof Error && NETWORK_PATTERN.test(error.message);
}

export async function loadAccessSnapshot(
  storage: SecureStoreApi,
  userId: string,
): Promise<AccessSnapshot | null> {
  const raw = await storage.getItemAsync(snapshotKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AccessSnapshot;
    return parsed.userId === userId && parsed.activeTenantId && Array.isArray(parsed.tenants) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearAccessSnapshot(storage: SecureStoreApi, userId: string): Promise<void> {
  await storage.deleteItemAsync(snapshotKey(userId));
}

/**
 * Online: the database decides. A tenant that is no longer listed is revoked and the device copy
 * is deleted. Offline (no connection, or a network failure): the device copy lets the user keep
 * working on local data; it is replaced as soon as the database can be reached.
 */
export async function resolveAccess(deps: AccessDeps): Promise<AccessResult> {
  const fetchTenants = deps.fetchTenants ?? listMyTenants;
  const fetchActive = deps.fetchActiveTenant ?? getActiveTenantId;

  let networkFailure = !(await deps.isOnline());
  if (!networkFailure) {
    try {
      const [tenants, dbActive] = await Promise.all([fetchTenants(deps.client), fetchActive(deps.client)]);
      const active = dbActive && tenants.some((tenant) => tenant.tenantId === dbActive) ? dbActive : null;
      if (tenants.length === 0 || active === null) {
        await clearAccessSnapshot(deps.storage, deps.userId);
        return { status: 'denied', reason: 'Tài khoản chưa có quyền truy cập đơn vị nào.' };
      }
      const snapshot: AccessSnapshot = {
        userId: deps.userId,
        tenants,
        activeTenantId: active,
        savedAt: (deps.now ?? Date.now)(),
      };
      await deps.storage.setItemAsync(snapshotKey(deps.userId), JSON.stringify(snapshot));
      return { status: 'ready', source: 'server', offline: false, tenants, activeTenantId: active };
    } catch (error) {
      if (!isNetworkError(error)) {
        return { status: 'denied', reason: error instanceof Error ? error.message : String(error) };
      }
      networkFailure = true;
    }
  }

  const snapshot = await loadAccessSnapshot(deps.storage, deps.userId);
  if (snapshot) {
    return {
      status: 'ready',
      source: 'snapshot',
      offline: networkFailure,
      tenants: snapshot.tenants,
      activeTenantId: snapshot.activeTenantId,
    };
  }
  return { status: 'unavailable', reason: 'Cần kết nối mạng ở lần đăng nhập đầu tiên.' };
}
