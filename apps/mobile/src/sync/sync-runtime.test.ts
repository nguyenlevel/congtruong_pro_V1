import { describe, expect, it } from 'vitest';
import type { LocalOutboxRecord, LocalSyncOutboxStore, LocalWorkerStore, RemoteWorkerWrite } from '../database';
import { createWorkerSyncRuntime } from './sync-runtime';
import { createSecureCursorStore } from './secure-cursor-store';
import type { PullRequest, SyncTransport } from '@partner-os/sync-engine';

const TENANT = 'd44c72ee-0000-4000-8000-000000000001';
const LOCAL_ID = '11111111-1111-4111-8111-111111111111';
const REMOTE_ID = '22222222-2222-4222-8222-222222222222';

const workerPayload = (id: string, fullName: string) => ({
  worker: {
    id,
    tenantId: TENANT,
    projectId: null,
    code: 'VN500',
    fullName,
    phoneNumber: '0912345678',
    status: 'ACTIVE',
  },
  deleted: false,
});

function fakeOutbox(initial: LocalOutboxRecord[]): LocalSyncOutboxStore {
  const records = [...initial];
  return {
    async enqueue(record) {
      records.push(record);
    },
    async pending() {
      return records.filter((record) => record.status === 'pending');
    },
    async countUnsynced() {
      const unsynced = records.filter((record) => record.status !== 'committed');
      const failed = unsynced.filter((record) => record.lastError !== null && record.status !== 'conflict').length;
      const conflict = unsynced.filter((record) => record.status === 'conflict').length;
      return { pending: unsynced.length - failed - conflict, failed, conflict, total: unsynced.length };
    },
    async markCommitted(operationId) {
      const record = records.find((row) => row.operationId === operationId);
      if (record) record.status = 'committed';
    },
    async markFailed(operationId, error) {
      const record = records.find((row) => row.operationId === operationId);
      if (record) {
        record.retryCount += 1;
        record.lastError = error;
      }
    },
  };
}

function pendingLocalWrite(): LocalOutboxRecord {
  return {
    operationId: 'op-1',
    deviceId: 'device-1',
    tenantId: TENANT,
    projectId: null,
    operation: 'update',
    recordType: 'worker',
    recordId: LOCAL_ID,
    payload: JSON.stringify(workerPayload(LOCAL_ID, 'Local edit').worker),
    version: 2,
    retryCount: 0,
    lastError: null,
    status: 'pending',
    createdAt: Date.parse('2026-09-23T00:00:00.000Z'),
  };
}

function fakeWorkers(): { store: LocalWorkerStore; applied: RemoteWorkerWrite[] } {
  const applied: RemoteWorkerWrite[] = [];
  const store = {
    async applyRemote(write: RemoteWorkerWrite) {
      applied.push(write);
    },
  } as unknown as LocalWorkerStore;
  return { store, applied };
}

describe('createWorkerSyncRuntime', () => {
  it('skips remote records that still have a pending local write and applies the rest', async () => {
    const outbox = fakeOutbox([pendingLocalWrite()]);
    const { store, applied } = fakeWorkers();
    const transport: SyncTransport = {
      async push() {
        return { acknowledged: false, serverVersion: 1 };
      },
      async pull(request: PullRequest) {
        if (request.cursor !== null) {
          return { cursor: request.cursor, records: [] };
        }
        return {
          cursor: '2026-09-23T01:00:00.000Z',
          records: [
            { recordId: LOCAL_ID, payload: workerPayload(LOCAL_ID, 'Server copy'), version: 5 },
            { recordId: REMOTE_ID, payload: workerPayload(REMOTE_ID, 'Remote worker'), version: 1 },
          ],
        };
      },
    };
    const cursors = new Map<string, string>();
    const cursorStore = {
      async read() {
        return cursors.get('cursor') ?? null;
      },
      async write(value: string) {
        cursors.set('cursor', value);
      },
    };

    await createWorkerSyncRuntime({ outbox, workers: store, transport, cursorStore }).syncNow();

    expect(applied.map((write) => write.worker.id)).toEqual([REMOTE_ID]);
    expect(applied[0]).toMatchObject({ version: 1, deleted: false });
    expect(cursors.get('cursor')).toBe('2026-09-23T01:00:00.000Z');
  });

  it('keeps a write unsynced after a network failure and commits it on retry', async () => {
    const record = pendingLocalWrite();
    const outbox = fakeOutbox([record]);
    const { store } = fakeWorkers();
    let online = false;
    const transport: SyncTransport = {
      async push() {
        if (!online) throw new Error('network down');
        return { acknowledged: true, serverVersion: 3 };
      },
      async pull(request: PullRequest) {
        return { cursor: request.cursor ?? 'start', records: [] };
      },
    };
    const cursorStore = {
      async read() {
        return null;
      },
      async write() {},
    };
    const runtime = createWorkerSyncRuntime({ outbox, workers: store, transport, cursorStore });

    await runtime.syncNow();
    expect(await outbox.countUnsynced()).toMatchObject({ pending: 0, failed: 1, total: 1 });
    expect(record.status).toBe('pending');
    expect(record.retryCount).toBe(1);

    online = true;
    await runtime.syncNow();
    expect(await outbox.countUnsynced()).toMatchObject({ total: 0 });
    expect(record.status).toBe('committed');
  });

  it('shares one run between concurrent syncNow calls', async () => {
    const countPulls = async (concurrent: boolean) => {
      let pulls = 0;
      const transport: SyncTransport = {
        async push() {
          return { acknowledged: true, serverVersion: 1 };
        },
        async pull(request: PullRequest) {
          pulls += 1;
          return { cursor: request.cursor ?? 'start', records: [] };
        },
      };
      const runtime = createWorkerSyncRuntime({
        outbox: fakeOutbox([]),
        workers: fakeWorkers().store,
        transport,
        cursorStore: createSecureCursorStore({
          async getItemAsync() {
            return null;
          },
          async setItemAsync() {},
          async deleteItemAsync() {},
        }, TENANT),
      });
      if (concurrent) {
        await Promise.all([runtime.syncNow(), runtime.syncNow()]);
      } else {
        await runtime.syncNow();
      }
      return pulls;
    };

    const single = await countPulls(false);
    const concurrent = await countPulls(true);

    expect(concurrent).toBe(single);
  });
});
