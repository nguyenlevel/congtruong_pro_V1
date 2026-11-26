import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocalSyncOutboxStore, UnsyncedCount } from '../database';
import { switchActiveTenant, UnsyncedBlockError } from './tenant-switch';

const TENANT_A = 'd44c72ee-0000-4000-8000-00000000000a';
const TENANT_B = 'd44c72ee-0000-4000-8000-00000000000b';
const EMPTY: UnsyncedCount = { pending: 0, failed: 0, conflict: 0, total: 0 };

function outboxWith(counts: UnsyncedCount): LocalSyncOutboxStore {
  return {
    async enqueue() {},
    async pending() {
      return [];
    },
    async countUnsynced() {
      return counts;
    },
  } as unknown as LocalSyncOutboxStore;
}

function clientWith(rpcError: { message: string } | null = null, rpcThrows = false) {
  const rpc = vi.fn(async () => {
    if (rpcThrows) throw new TypeError('Network request failed');
    return { error: rpcError };
  });
  const refreshSession = vi.fn(async () => ({ error: null }));
  const client = { rpc, auth: { refreshSession } } as unknown as SupabaseClient;
  return { client, rpc, refreshSession };
}

async function captureBlock(promise: Promise<void>): Promise<UnsyncedBlockError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(UnsyncedBlockError);
  return error as UnsyncedBlockError;
}

describe('switchActiveTenant', () => {
  it('refuses to switch while writes are pending and does not call the database', async () => {
    const { client, rpc } = clientWith();
    const error = await captureBlock(
      switchActiveTenant(client, outboxWith({ pending: 2, failed: 0, conflict: 0, total: 2 }), TENANT_B),
    );
    expect(error.counts).toEqual({ pending: 2, failed: 0, conflict: 0, total: 2 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps blocking while a failed write awaits retry, and reports it as failed', async () => {
    const { client, rpc } = clientWith();
    const error = await captureBlock(
      switchActiveTenant(client, outboxWith({ pending: 0, failed: 1, conflict: 0, total: 1 }), TENANT_B),
    );
    expect(error.counts.failed).toBe(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('blocks while a conflict waits for a user decision', async () => {
    const { client, rpc } = clientWith();
    const error = await captureBlock(
      switchActiveTenant(client, outboxWith({ pending: 0, failed: 0, conflict: 1, total: 1 }), TENANT_B),
    );
    expect(error.counts.conflict).toBe(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('selects the tenant through the database RPC and refreshes the session when outbox is empty', async () => {
    const { client, rpc, refreshSession } = clientWith();
    await switchActiveTenant(client, outboxWith(EMPTY), TENANT_B);
    expect(rpc).toHaveBeenCalledWith('select_active_tenant', { p_tenant_id: TENANT_B });
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('surfaces a database rejection (non-member) and does not refresh the session', async () => {
    const { client, refreshSession } = clientWith({ message: 'not a member of this tenant' });
    await expect(switchActiveTenant(client, outboxWith(EMPTY), TENANT_B)).rejects.toThrow('not a member');
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('keeps the current tenant when the network drops during the switch', async () => {
    const { client, refreshSession } = clientWith(null, true);
    await expect(switchActiveTenant(client, outboxWith(EMPTY), TENANT_B)).rejects.toThrow('Network request failed');
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('refuses a switch when membership was revoked, even with a still-valid JWT', async () => {
    const { client, refreshSession } = clientWith({ message: 'not a member of this tenant' });
    await expect(switchActiveTenant(client, outboxWith(EMPTY), TENANT_A)).rejects.toThrow('not a member');
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('keeps blocking after a failed sync until the retry drains the outbox', async () => {
    const counts = { value: { pending: 0, failed: 1, conflict: 0, total: 1 } as UnsyncedCount };
    const outbox = {
      async countUnsynced() {
        return counts.value;
      },
    } as unknown as LocalSyncOutboxStore;
    const { client, rpc } = clientWith();

    await captureBlock(switchActiveTenant(client, outbox, TENANT_B));
    counts.value = EMPTY;
    await switchActiveTenant(client, outbox, TENANT_B);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('allows switching back and forth between two tenants once the outbox is drained', async () => {
    const { client, rpc } = clientWith();
    await switchActiveTenant(client, outboxWith(EMPTY), TENANT_B);
    await switchActiveTenant(client, outboxWith(EMPTY), TENANT_A);
    expect(rpc).toHaveBeenNthCalledWith(1, 'select_active_tenant', { p_tenant_id: TENANT_B });
    expect(rpc).toHaveBeenNthCalledWith(2, 'select_active_tenant', { p_tenant_id: TENANT_A });
  });
});
