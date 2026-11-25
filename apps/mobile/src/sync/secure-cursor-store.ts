import type { SyncCursor } from '@partner-os/sync-engine';
import type { CursorStore } from './sync-runtime';
import type { SecureStoreApi } from '../auth/chunked-secure-storage';

const CURSOR_KEY_PREFIX = 'sync';

/** Each tenant + record type keeps its own pull cursor so switching tenants never reuses another tenant's position. */
export function cursorKeyForTenant(tenantId: string, recordType = 'worker'): string {
  return `${CURSOR_KEY_PREFIX}.${recordType}.cursor.${tenantId}`;
}

const CURSOR_RECORD_TYPES = ['worker', 'attendance'] as const;

/** Removes every pull cursor for the given tenants so the next owner of the device syncs from scratch. */
export async function clearCursors(store: SecureStoreApi, tenantIds: readonly string[]): Promise<void> {
  for (const tenantId of tenantIds) {
    for (const recordType of CURSOR_RECORD_TYPES) {
      await store.deleteItemAsync(cursorKeyForTenant(tenantId, recordType));
    }
  }
}

export function createSecureCursorStore(
  store: SecureStoreApi,
  tenantId: string,
  recordType = 'worker',
): CursorStore {
  const key = cursorKeyForTenant(tenantId, recordType);
  return {
    async read() {
      return (await store.getItemAsync(key)) as SyncCursor | null;
    },
    async write(cursor) {
      await store.setItemAsync(key, cursor);
    },
  };
}
