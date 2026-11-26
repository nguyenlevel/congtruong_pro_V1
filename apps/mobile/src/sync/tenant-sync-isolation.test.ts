import { describe, expect, it } from 'vitest';
import { createSecureCursorStore, cursorKeyForTenant } from './secure-cursor-store';
import type { SecureStoreApi } from '../auth/chunked-secure-storage';

const TENANT_A = 'd44c72ee-0000-4000-8000-00000000000a';
const TENANT_B = 'd44c72ee-0000-4000-8000-00000000000b';

function memoryStore(): SecureStoreApi & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItemAsync(key: string) {
      return data.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string) {
      data.set(key, value);
    },
    async deleteItemAsync(key: string) {
      data.delete(key);
    },
  };
}

describe('per-tenant sync cursor', () => {
  it('keeps each tenant cursor isolated after switching A -> B -> A', async () => {
    const store = memoryStore();
    const cursorA = createSecureCursorStore(store, TENANT_A);
    const cursorB = createSecureCursorStore(store, TENANT_B);

    await cursorA.write('cursor-a-1');
    expect(await cursorB.read()).toBeNull();

    await cursorB.write('cursor-b-1');
    expect(await cursorA.read()).toBe('cursor-a-1');
    expect(await cursorB.read()).toBe('cursor-b-1');
    expect(cursorKeyForTenant(TENANT_A)).not.toBe(cursorKeyForTenant(TENANT_B));
  });
});

