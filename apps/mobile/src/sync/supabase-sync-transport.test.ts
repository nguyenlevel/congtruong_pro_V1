import type { SupabaseClient } from '@supabase/supabase-js';
import type { OutboxRecord } from '@partner-os/sync-engine';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseSyncTransport } from './supabase-sync-transport';

const WORKER = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  projectId: null,
  code: 'W001',
  fullName: 'Nguyen Van A',
  phoneNumber: '0900000000',
  status: 'ACTIVE',
};

const SERVER_ROW = {
  id: WORKER.id,
  tenant_id: WORKER.tenantId,
  project_id: null,
  code: 'W001',
  full_name: 'Nguyen Van A',
  phone_number: '0900000000',
  status: 'ACTIVE',
  version: 1,
  updated_at: '2026-01-05T00:00:00.000Z',
  deleted_at: null,
};

type Result = { data: unknown; error: { code?: string; message?: string } | null };

function outboxRecord(overrides: Partial<OutboxRecord<unknown>> = {}): OutboxRecord<unknown> {
  return {
    operationId: 'op-1',
    deviceId: 'device-1',
    recordType: 'worker',
    recordId: WORKER.id,
    operation: 'create',
    payload: WORKER,
    version: 1,
    clientTimestamp: '2026-01-01T00:00:00.000Z',
    retryCount: 0,
    lastError: null,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Builder stub. Every filter returns the same chain. `maybeSingle` resolves the scripted results in
 * order (write result first, then the read-back); `limit` resolves the pull result.
 */
function fakeClient(script: Result[], pullResult: Result = { data: [], error: null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['insert', 'update', 'select', 'eq', 'order', 'or']) {
    chain[method] = vi.fn(() => chain);
  }
  const queue = [...script];
  chain.maybeSingle = vi.fn(async () => queue.shift() ?? { data: null, error: null });
  chain.limit = vi.fn(async () => pullResult);
  return { client: { from: vi.fn(() => chain) } as unknown as SupabaseClient, chain };
}

describe('createSupabaseSyncTransport push', () => {
  it('acknowledges a create the server accepted', async () => {
    const { client } = fakeClient([{ data: { version: 1 }, error: null }]);
    const result = await createSupabaseSyncTransport(client).push('op-1', outboxRecord());
    expect(result).toEqual({ acknowledged: true, serverVersion: 1 });
  });

  it('acknowledges a replayed create whose row already holds the same data (lost ack)', async () => {
    const { client } = fakeClient([
      { data: null, error: { code: '23505', message: 'duplicate' } },
      { data: SERVER_ROW, error: null },
    ]);
    const result = await createSupabaseSyncTransport(client).push('op-1', outboxRecord());
    expect(result).toEqual({ acknowledged: true, serverVersion: 1 });
  });

  it('reports a duplicate key with different data as a conflict carrying the server copy', async () => {
    const { client } = fakeClient([
      { data: null, error: { code: '23505', message: 'duplicate' } },
      { data: { ...SERVER_ROW, full_name: 'Someone Else' }, error: null },
    ]);
    const result = await createSupabaseSyncTransport(client).push('op-1', outboxRecord());
    expect(result.acknowledged).toBe(false);
    expect(result.conflict?.serverVersion).toBe(1);
    expect(result.conflict?.serverPayload).toMatchObject({ worker: { fullName: 'Someone Else' }, deleted: false });
  });

  it('reports a unique-key clash on another row as a conflict without a server copy', async () => {
    const { client } = fakeClient([
      { data: null, error: { code: '23505', message: 'duplicate code' } },
      { data: null, error: null },
    ]);
    const result = await createSupabaseSyncTransport(client).push('op-1', outboxRecord());
    expect(result).toMatchObject({ acknowledged: false, conflict: { serverVersion: 0, serverPayload: null } });
  });

  it('applies an update only when the server still holds the previous version', async () => {
    const { client, chain } = fakeClient([{ data: { version: 3 }, error: null }]);
    const result = await createSupabaseSyncTransport(client).push(
      'op-2',
      outboxRecord({ operation: 'update', version: 3 }),
    );
    expect(result).toEqual({ acknowledged: true, serverVersion: 3 });
    expect(chain.eq).toHaveBeenCalledWith('version', 2);
  });

  it('acknowledges a replayed update that the server already holds', async () => {
    const { client } = fakeClient([
      { data: null, error: null },
      { data: { ...SERVER_ROW, version: 3 }, error: null },
    ]);
    const result = await createSupabaseSyncTransport(client).push(
      'op-2',
      outboxRecord({ operation: 'update', version: 3 }),
    );
    expect(result).toEqual({ acknowledged: true, serverVersion: 3 });
  });

  it('reports a stale update as a conflict instead of overwriting newer server data', async () => {
    const { client } = fakeClient([
      { data: null, error: null },
      { data: { ...SERVER_ROW, version: 4, full_name: 'Edited elsewhere' }, error: null },
    ]);
    const result = await createSupabaseSyncTransport(client).push(
      'op-2',
      outboxRecord({ operation: 'update', version: 3 }),
    );
    expect(result.acknowledged).toBe(false);
    expect(result.conflict?.serverVersion).toBe(4);
  });

  it('acknowledges a replayed delete when the row is already deleted', async () => {
    const { client } = fakeClient([
      { data: null, error: null },
      { data: { ...SERVER_ROW, version: 2, deleted_at: '2026-01-06T00:00:00.000Z' }, error: null },
    ]);
    const result = await createSupabaseSyncTransport(client).push(
      'op-3',
      outboxRecord({ operation: 'delete', version: 2 }),
    );
    expect(result).toEqual({ acknowledged: true, serverVersion: 2 });
  });

  it('throws on unexpected database errors so the push is retried', async () => {
    const { client } = fakeClient([{ data: null, error: { code: '57014', message: 'timeout' } }]);
    await expect(createSupabaseSyncTransport(client).push('op-1', outboxRecord())).rejects.toMatchObject({
      code: '57014',
    });
  });

  it('rejects record types it does not sync', async () => {
    const { client } = fakeClient([]);
    await expect(
      createSupabaseSyncTransport(client).push('op-3', outboxRecord({ recordType: 'incident' })),
    ).rejects.toThrow('Unsupported record type');
  });
});

describe('createSupabaseSyncTransport pull', () => {
  it('pages by (updated_at, id) so rows sharing a timestamp are not skipped', async () => {
    const rows = [
      { ...SERVER_ROW, id: 'aaa', version: 2, updated_at: '2026-01-05T00:00:00.000Z' },
      { ...SERVER_ROW, id: 'bbb', version: 2, updated_at: '2026-01-05T00:00:00.000Z' },
    ];
    const withRows = fakeClient([], { data: rows, error: null });

    const batch = await createSupabaseSyncTransport(withRows.client).pull({
      cursor: '2026-01-01T00:00:00.000Z|00000000-0000-0000-0000-0000000000aa',
    });

    expect(withRows.chain.or).toHaveBeenCalledWith(
      'updated_at.gt."2026-01-01T00:00:00.000Z",and(updated_at.eq."2026-01-01T00:00:00.000Z",id.gt."00000000-0000-0000-0000-0000000000aa")',
    );
    expect(withRows.chain.order).toHaveBeenCalledWith('updated_at', { ascending: true });
    expect(withRows.chain.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(batch.cursor).toBe('2026-01-05T00:00:00.000Z|bbb');
    expect(batch.records[0]).toMatchObject({ recordId: 'aaa', version: 2 });
  });

  it('keeps the cursor when nothing changed and accepts a legacy timestamp-only cursor', async () => {
    const empty = fakeClient([], { data: [], error: null });
    const same = await createSupabaseSyncTransport(empty.client).pull({ cursor: '2026-02-01T00:00:00.000Z' });
    expect(same.cursor).toBe('2026-02-01T00:00:00.000Z');
    expect(empty.chain.or).toHaveBeenCalledWith(expect.stringContaining('id.gt."00000000-0000-0000-0000-000000000000"'));
  });
});
