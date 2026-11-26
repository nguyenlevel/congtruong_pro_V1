import type { LocalSyncOutboxStore } from '../database';
import type { SecureStoreApi } from './chunked-secure-storage';

const OWNER_KEY = 'local.owner';

export type OwnerDecision = 'keep' | 'wipe' | 'blocked';

/**
 * The device database belongs to the last user who signed in. A different user may take it over
 * only when nothing is waiting to sync: pending changes of the previous user must reach the server
 * under their own session, never under another account.
 */
export function decideLocalOwner(ownerId: string | null, userId: string, unsynced: number): OwnerDecision {
  if (ownerId === null || ownerId === userId) return 'keep';
  return unsynced > 0 ? 'blocked' : 'wipe';
}

export interface PrepareLocalDataDeps {
  storage: SecureStoreApi;
  outbox: LocalSyncOutboxStore;
  userId: string;
  /** Deletes the local database. Called only when the previous owner has nothing left to sync. */
  clearLocalData(): Promise<void>;
  /** Deletes sync cursors so the next owner pulls from scratch. */
  clearCursors(): Promise<void>;
}

export async function prepareLocalData(deps: PrepareLocalDataDeps): Promise<'ready' | 'blocked'> {
  const owner = await deps.storage.getItemAsync(OWNER_KEY);
  const { total } = await deps.outbox.countUnsynced();
  const decision = decideLocalOwner(owner, deps.userId, total);
  if (decision === 'blocked') return 'blocked';
  if (decision === 'wipe') {
    await deps.clearLocalData();
    await deps.clearCursors();
  }
  if (owner !== deps.userId) {
    await deps.storage.setItemAsync(OWNER_KEY, deps.userId);
  }
  return 'ready';
}

export async function releaseLocalOwner(storage: SecureStoreApi): Promise<void> {
  await storage.deleteItemAsync(OWNER_KEY);
}
