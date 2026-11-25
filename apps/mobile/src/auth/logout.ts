import type { LocalSyncOutboxStore, UnsyncedCount } from '../database';
import type { SecureStoreApi } from './chunked-secure-storage';
import { releaseLocalOwner } from './local-owner';

export interface LogoutPlan {
  unsynced: UnsyncedCount;
  /** True when the user must be warned: changes are still waiting to sync. */
  requiresWarning: boolean;
}

export async function planLogout(outbox: LocalSyncOutboxStore): Promise<LogoutPlan> {
  const unsynced = await outbox.countUnsynced();
  return { unsynced, requiresWarning: unsynced.total > 0 };
}

export interface PerformLogoutDeps {
  storage: SecureStoreApi;
  outbox: LocalSyncOutboxStore;
  signOut(): Promise<void>;
  clearLocalData(): Promise<void>;
  clearCursors(): Promise<void>;
}

/**
 * Signs out. Unsynced changes are never deleted: they stay on the device and sync when the same
 * user signs in again. When nothing is waiting, the local data of this user is removed.
 * Returns whether local data was removed.
 */
export async function performLogout(deps: PerformLogoutDeps): Promise<boolean> {
  const { total } = await deps.outbox.countUnsynced();
  await deps.signOut();
  if (total > 0) return false;
  await deps.clearLocalData();
  await deps.clearCursors();
  await releaseLocalOwner(deps.storage);
  return true;
}
