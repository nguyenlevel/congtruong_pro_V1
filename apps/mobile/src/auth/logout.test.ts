import { describe, expect, it, vi } from 'vitest';
import type { LocalSyncOutboxStore, UnsyncedCount } from '../database';
import type { SecureStoreApi } from './chunked-secure-storage';
import { performLogout, planLogout } from './logout';
import { decideLocalOwner, prepareLocalData } from './local-owner';

function memoryStore(initial: Record<string, string> = {}): SecureStoreApi & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
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

function outboxWith(total: number): LocalSyncOutboxStore {
  const counts: UnsyncedCount = { pending: total, failed: 0, conflict: 0, total };
  return { countUnsynced: async () => counts } as unknown as LocalSyncOutboxStore;
}

describe('decideLocalOwner', () => {
  it('keeps the data for the same user or an unknown owner', () => {
    expect(decideLocalOwner(null, 'u1', 5)).toBe('keep');
    expect(decideLocalOwner('u1', 'u1', 5)).toBe('keep');
  });

  it('lets a different user take over only when nothing is waiting to sync', () => {
    expect(decideLocalOwner('u1', 'u2', 0)).toBe('wipe');
    expect(decideLocalOwner('u1', 'u2', 3)).toBe('blocked');
  });
});

describe('prepareLocalData', () => {
  it('blocks another user while the previous owner has unsynced changes and wipes nothing', async () => {
    const clearLocalData = vi.fn(async () => undefined);
    const storage = memoryStore({ 'local.owner': 'u1' });

    const result = await prepareLocalData({
      storage, outbox: outboxWith(2), userId: 'u2', clearLocalData, clearCursors: vi.fn(async () => undefined),
    });

    expect(result).toBe('blocked');
    expect(clearLocalData).not.toHaveBeenCalled();
    expect(storage.data.get('local.owner')).toBe('u1');
  });

  it('wipes local data and cursors for a new user once the old owner is synced, then records the new owner', async () => {
    const clearLocalData = vi.fn(async () => undefined);
    const clearCursors = vi.fn(async () => undefined);
    const storage = memoryStore({ 'local.owner': 'u1' });

    const result = await prepareLocalData({ storage, outbox: outboxWith(0), userId: 'u2', clearLocalData, clearCursors });

    expect(result).toBe('ready');
    expect(clearLocalData).toHaveBeenCalledTimes(1);
    expect(clearCursors).toHaveBeenCalledTimes(1);
    expect(storage.data.get('local.owner')).toBe('u2');
  });

  it('claims an unowned device without wiping it', async () => {
    const clearLocalData = vi.fn(async () => undefined);
    const storage = memoryStore();

    await prepareLocalData({ storage, outbox: outboxWith(4), userId: 'u1', clearLocalData, clearCursors: vi.fn(async () => undefined) });

    expect(clearLocalData).not.toHaveBeenCalled();
    expect(storage.data.get('local.owner')).toBe('u1');
  });
});

describe('logout', () => {
  it('warns when changes are waiting and not otherwise', async () => {
    expect((await planLogout(outboxWith(3))).requiresWarning).toBe(true);
    expect((await planLogout(outboxWith(0))).requiresWarning).toBe(false);
  });

  it('never deletes unsynced changes when signing out', async () => {
    const clearLocalData = vi.fn(async () => undefined);
    const signOut = vi.fn(async () => undefined);

    const removed = await performLogout({
      storage: memoryStore({ 'local.owner': 'u1' }),
      outbox: outboxWith(2),
      signOut,
      clearLocalData,
      clearCursors: vi.fn(async () => undefined),
    });

    expect(removed).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearLocalData).not.toHaveBeenCalled();
  });

  it('removes local data of the user when everything is synced', async () => {
    const storage = memoryStore({ 'local.owner': 'u1' });
    const clearLocalData = vi.fn(async () => undefined);

    const removed = await performLogout({
      storage, outbox: outboxWith(0), signOut: async () => undefined, clearLocalData, clearCursors: vi.fn(async () => undefined),
    });

    expect(removed).toBe(true);
    expect(clearLocalData).toHaveBeenCalledTimes(1);
    expect(storage.data.has('local.owner')).toBe(false);
  });
});
