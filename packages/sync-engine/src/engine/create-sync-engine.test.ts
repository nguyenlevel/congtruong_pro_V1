import { describe, expect, it, vi } from 'vitest';
import { createSyncEngine, type SyncOutboxPort } from './create-sync-engine';
import type { OutboxRecord } from '../outbox/outbox';
import type { PullBatch, SyncTransport } from '../transport/transport';

function record(operationId: string, overrides: Partial<OutboxRecord<unknown>> = {}): OutboxRecord<unknown> {
  return {
    operationId,
    deviceId: 'device-1',
    recordType: 'worker',
    recordId: `w-${operationId}`,
    operation: 'create',
    payload: { id: `w-${operationId}` },
    version: 1,
    clientTimestamp: '2026-01-01T00:00:00.000Z',
    retryCount: 0,
    lastError: null,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fakeOutbox(initial: OutboxRecord<unknown>[]) {
  const rows = new Map(initial.map((r) => [r.operationId, { ...r }]));
  const outbox: SyncOutboxPort = {
    pending: async () => [...rows.values()].filter((r) => r.status === 'pending'),
    markCommitted: async (id) => {
      rows.get(id)!.status = 'committed';
    },
    markFailed: async (id, error) => {
      const row = rows.get(id)!;
      row.retryCount += 1;
      row.lastError = error;
    },
  };
  return { outbox, rows };
}

describe('createSyncEngine', () => {
  it('commits acknowledged records and reports push stats', async () => {
    const { outbox, rows } = fakeOutbox([record('op-1')]);
    const transport: SyncTransport = {
      push: vi.fn(async () => ({ acknowledged: true, serverVersion: 1 })),
      pull: vi.fn(),
    };

    const stats = await createSyncEngine({ outbox, transport }).flush('worker');

    expect(stats.pushed).toBe(1);
    expect(rows.get('op-1')!.status).toBe('committed');
  });

  it('keeps a rejected record pending with the error and counts a retry', async () => {
    const { outbox, rows } = fakeOutbox([record('op-2')]);
    const transport: SyncTransport = {
      push: async () => {
        throw new Error('network down');
      },
      pull: vi.fn(),
    };

    const stats = await createSyncEngine({ outbox, transport }).flush();

    expect(stats).toMatchObject({ pushed: 0, errors: 1, retries: 1 });
    expect(rows.get('op-2')).toMatchObject({ status: 'pending', retryCount: 1, lastError: 'network down' });
  });

  it('stops picking a record once maxAttempts is reached', async () => {
    const { outbox } = fakeOutbox([record('op-3', { retryCount: 5 })]);
    const push = vi.fn(async () => ({ acknowledged: true, serverVersion: 1 }));

    const stats = await createSyncEngine({ outbox, transport: { push, pull: vi.fn() } }).flush();

    expect(push).not.toHaveBeenCalled();
    expect(stats.pushed).toBe(0);
  });

  it('treats an unacknowledged (version conflict) push as a failure', async () => {
    const { outbox, rows } = fakeOutbox([record('op-4', { operation: 'update', version: 2 })]);
    const transport: SyncTransport = {
      push: async () => ({ acknowledged: false, serverVersion: 3 }),
      pull: vi.fn(),
    };

    const stats = await createSyncEngine({ outbox, transport }).flush();

    expect(stats.errors).toBe(1);
    expect(rows.get('op-4')!.status).toBe('pending');
  });

  it('does not push later operations of a record after an earlier one failed', async () => {
    const { outbox } = fakeOutbox([
      record('op-7a', { recordId: 'w-same' }),
      record('op-7b', { recordId: 'w-same', operation: 'update', version: 2 }),
      record('op-7c', { recordId: 'w-other' }),
    ]);
    const push = vi.fn(async (_id: string, rec: OutboxRecord<unknown>) => {
      if (rec.operationId === 'op-7a') throw new Error('network down');
      return { acknowledged: true, serverVersion: rec.version };
    });

    const stats = await createSyncEngine({ outbox, transport: { push: push as SyncTransport['push'], pull: vi.fn() } }).flush();

    expect(push.mock.calls.map(([id]) => id)).toEqual(['op-7a', 'op-7c']);
    expect(stats).toMatchObject({ pushed: 1, errors: 1 });
  });

  it('parks a conflicting push as a conflict instead of retrying it', async () => {
    const { outbox, rows } = fakeOutbox([record('op-6', { operation: 'update', version: 2 })]);
    const markConflict = vi.fn(async (id: string) => {
      rows.get(id)!.status = 'failed';
    });
    const transport: SyncTransport = {
      push: async () => ({
        acknowledged: false,
        serverVersion: 3,
        conflict: { serverVersion: 3, serverPayload: { worker: { id: 'w' } } },
      }),
      pull: vi.fn(),
    };

    const stats = await createSyncEngine({ outbox: { ...outbox, markConflict }, transport }).flush();

    expect(stats).toMatchObject({ conflicts: 1, errors: 0, pushed: 0 });
    expect(markConflict).toHaveBeenCalledWith('op-6', expect.stringContaining('version 3'), { worker: { id: 'w' } }, 3);
  });

  it('applies pulled records and advances the cursor only from the server watermark', async () => {
    const applyRemote = vi.fn(async (_batch: PullBatch) => undefined);
    const transport: SyncTransport = {
      push: vi.fn(),
      pull: async () => ({
        cursor: '2026-01-02T00:00:00.000Z',
        records: [{ recordId: 'w-1', payload: {}, version: 1 }],
      }),
    };
    const engine = createSyncEngine({ outbox: fakeOutbox([]).outbox, transport, applyRemote });

    const cursor = await engine.pull('2026-01-01T00:00:00.000Z');

    expect(applyRemote).toHaveBeenCalledTimes(1);
    expect(cursor).toBe('2026-01-02T00:00:00.000Z');
    expect(await engine.pull('2026-03-01T00:00:00.000Z')).toBe('2026-03-01T00:00:00.000Z');
  });

  it('notifies subscribers of audit entries until unsubscribed', async () => {
    const { outbox } = fakeOutbox([record('op-5')]);
    const transport: SyncTransport = {
      push: async () => ({ acknowledged: true, serverVersion: 1 }),
      pull: vi.fn(),
    };
    const engine = createSyncEngine({ outbox, transport });
    const seen: string[] = [];
    const unsubscribe = engine.subscribe((entry) => seen.push(entry.action));

    await engine.flush();
    unsubscribe();
    await engine.flush();

    expect(seen).toEqual(['commit']);
  });
});
