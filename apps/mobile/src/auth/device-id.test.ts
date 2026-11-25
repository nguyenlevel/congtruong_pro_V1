import { describe, expect, it } from 'vitest';
import type { SecureStoreApi } from './chunked-secure-storage';
import { getOrCreateDeviceId } from './device-id';

function memoryStore(): SecureStoreApi {
  const data = new Map<string, string>();
  return {
    getItemAsync: async (key) => data.get(key) ?? null,
    setItemAsync: async (key, value) => {
      data.set(key, value);
    },
    deleteItemAsync: async (key) => {
      data.delete(key);
    },
  };
}

describe('getOrCreateDeviceId', () => {
  it('creates an id once and keeps returning it', async () => {
    const store = memoryStore();
    const first = await getOrCreateDeviceId(store);
    expect(first).not.toBe('');
    expect(await getOrCreateDeviceId(store)).toBe(first);
  });

  it('uses the configured id without storing anything', async () => {
    const store = memoryStore();
    expect(await getOrCreateDeviceId(store, 'ci-device')).toBe('ci-device');
    expect(await store.getItemAsync('device.id')).toBeNull();
  });
});
