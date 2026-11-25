import { describe, expect, it } from 'vitest';
import type { Worker } from '@partner-os/domain';
import type { LocalOutboxRecord, LocalWorkerStore, LocalSyncOutboxStore } from '../../../database';
import { createLocalWorkerRepository } from '../database/localWorkerRepository';
import { createWorkerOffline } from './offline-worker';

interface FakeDb {
  rows: Worker[];
  outboxRecords: LocalOutboxRecord[];
  workers: LocalWorkerStore;
  outbox: LocalSyncOutboxStore;
}

function fakeDatabase(): FakeDb {
  const rows: Worker[] = [];
  const outboxRecords: LocalOutboxRecord[] = [];
  const versions = new Map<string, number>();

  const workers: LocalWorkerStore = {
    async list() {
      return [...rows];
    },
    async findById(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async insert(record) {
      rows.push(record);
      versions.set(record.id, 1);
    },
    async update(id, patch) {
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) {
        throw new Error(`worker not found: ${id}`);
      }
      const updated = { ...rows[index]!, ...patch, id } as Worker;
      rows[index] = updated;
      versions.set(id, (versions.get(id) ?? 1) + 1);
      return updated;
    },
    async remove(id) {
      const index = rows.findIndex((row) => row.id === id);
      if (index !== -1) {
        rows.splice(index, 1);
      }
    },
    async versionOf(id) {
      return versions.get(id) ?? null;
    },
    async applyRemote() {},
  };

  const outbox: LocalSyncOutboxStore = {
    async enqueue(record) {
      outboxRecords.push(record);
    },
    async pending() {
      return [...outboxRecords];
    },
    async countUnsynced() {
      const unsynced = outboxRecords.filter((record) => record.status !== 'committed');
      const failed = unsynced.filter((record) => record.lastError !== null).length;
      return { pending: unsynced.length - failed, failed, conflict: 0, total: unsynced.length };
    },
    async markCommitted(operationId) {
      const record = outboxRecords.find((row) => row.operationId === operationId);
      if (record) record.status = 'committed';
    },
    async markFailed(operationId, error) {
      const record = outboxRecords.find((row) => row.operationId === operationId);
      if (record) {
        record.status = 'failed';
        record.lastError = error;
      }
    },
  };

  return { rows, outboxRecords, workers, outbox };
}

describe('createWorkerOffline (offline-first)', () => {
  it('validates, persists to the local store and enqueues a create operation', async () => {
    const db = fakeDatabase();
    const repo = createLocalWorkerRepository(
      { workers: db.workers, outbox: db.outbox },
      'device-1',
    );

    const worker = await createWorkerOffline(repo, {
      tenantId: 'd44c72ee-0000-4000-8000-000000000001',
      projectId: null,
      code: 'VN500',
      fullName: 'Kim Min Joon',
      phoneNumber: '0912345678',
    });

    expect(worker.id).toHaveLength(36);
    expect(db.rows).toHaveLength(1);
    expect(db.outboxRecords).toHaveLength(1);

    const record = db.outboxRecords[0]!;
    expect(record.operation).toBe('create');
    expect(record.deviceId).toBe('device-1');
    const payload = JSON.parse(record.payload) as Worker;
    expect(payload.code).toBe('VN500');
    expect(payload.tenantId).toBe('d44c72ee-0000-4000-8000-000000000001');
  });

  it('rejects invalid input at the boundary and persists nothing', async () => {
    const db = fakeDatabase();
    const repo = createLocalWorkerRepository(
      { workers: db.workers, outbox: db.outbox },
      'device-1',
    );

    await expect(
      createWorkerOffline(repo, {
        tenantId: '',
        projectId: null,
        code: 'X',
        fullName: 'A',
        phoneNumber: '000',
      }),
    ).rejects.toThrow();

    expect(db.rows).toHaveLength(0);
    expect(db.outboxRecords).toHaveLength(0);
  });

  it('advances the outbox version on each local write so pushes match the server chain', async () => {
    const db = fakeDatabase();
    const repo = createLocalWorkerRepository(
      { workers: db.workers, outbox: db.outbox },
      'device-1',
    );

    const worker = await createWorkerOffline(repo, {
      tenantId: 'd44c72ee-0000-4000-8000-000000000001',
      projectId: null,
      code: 'VN500',
      fullName: 'Kim Min Joon',
      phoneNumber: '0912345678',
    });
    await repo.update(worker.id, { fullName: 'Kim Min Ho' });
    await repo.update(worker.id, { fullName: 'Kim Min Hyuk' });

    expect(db.outboxRecords.map((record) => record.version)).toEqual([1, 2, 3]);
    expect(db.outboxRecords.map((record) => record.operation)).toEqual([
      'create',
      'update',
      'update',
    ]);
  });
});
