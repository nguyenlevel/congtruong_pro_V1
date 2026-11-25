import { describe, expect, it } from 'vitest';
import type { Worker } from '@partner-os/domain';
import type { LocalConflictOutboxStore, LocalOutboxRecord, LocalWorkerStore } from '../database';
import { canKeepMine, createWorkerAdapter, resolveConflict, retryExhausted } from './conflict-resolution';

const ID = '11111111-1111-4111-8111-111111111111';
const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const mine: Worker = {
  id: ID,
  tenantId: TENANT,
  projectId: null,
  code: 'W001',
  fullName: 'Mine',
  phoneNumber: '0900000000',
  status: 'ACTIVE',
};
const theirs: Worker = { ...mine, fullName: 'Theirs' };

function conflictRecord(overrides: Partial<LocalOutboxRecord> = {}): LocalOutboxRecord {
  return {
    operationId: 'op-1',
    deviceId: 'device-1',
    tenantId: TENANT,
    projectId: null,
    recordType: 'worker',
    recordId: ID,
    operation: 'update',
    payload: JSON.stringify(mine),
    version: 3,
    retryCount: 0,
    lastError: 'Conflict',
    status: 'conflict',
    createdAt: 1,
    serverSnapshot: JSON.stringify({ worker: theirs, deleted: false }),
    serverVersion: 4,
    ...overrides,
  };
}

function setup(initial: LocalOutboxRecord[], local: Worker | null = mine) {
  const rows = [...initial];
  const applied: Array<{ worker: Worker; version: number; deleted: boolean }> = [];
  let current = local;
  const outbox = {
    async enqueue(record: LocalOutboxRecord) {
      rows.push(record);
    },
    async discardRecordOperations(recordId: string) {
      const open = rows.filter((row) => row.recordId === recordId && row.status !== 'committed');
      open.forEach((row) => {
        row.status = 'committed';
      });
      return open.length;
    },
    async resetRetries(operationId: string) {
      const row = rows.find((r) => r.operationId === operationId)!;
      row.retryCount = 0;
      row.lastError = null;
    },
  } as unknown as LocalConflictOutboxStore;
  const workers = {
    async findById() {
      return current;
    },
    async applyRemote(write: { worker: Worker; version: number; deleted: boolean }) {
      applied.push(write);
      current = write.deleted ? null : write.worker;
    },
  } as unknown as LocalWorkerStore;
  const deps = {
    outbox,
    adapters: { worker: createWorkerAdapter(workers) },
    now: () => 99,
    createOperationId: () => 'new-op',
  };
  return { rows, applied, deps };
}

describe('resolveConflict', () => {
  it('keep_server discards every local operation of the record and restores the server copy', async () => {
    const later = conflictRecord({ operationId: 'op-2', status: 'pending', version: 4, lastError: null });
    const { rows, applied, deps } = setup([conflictRecord(), later]);

    await resolveConflict(deps, rows[0]!, 'keep_server');

    expect(rows.map((row) => row.status)).toEqual(['committed', 'committed']);
    expect(applied).toEqual([{ worker: theirs, version: 4, deleted: false }]);
  });

  it('keep_server removes the local row when the server has no copy', async () => {
    const record = conflictRecord({ operation: 'create', serverSnapshot: null, serverVersion: 0 });
    const { applied, deps } = setup([record]);

    await resolveConflict(deps, record, 'keep_server');

    expect(applied).toEqual([{ worker: mine, version: 3, deleted: true }]);
  });

  it('keep_mine rebases the current local data on the server version and queues it again', async () => {
    const edited = { ...mine, fullName: 'Mine edited again' };
    const record = conflictRecord();
    const { rows, applied, deps } = setup([record], edited);

    await resolveConflict(deps, record, 'keep_mine');

    expect(applied).toEqual([{ worker: edited, version: 4, deleted: false }]);
    const queued = rows.at(-1)!;
    expect(queued).toMatchObject({
      operationId: 'new-op',
      operation: 'update',
      version: 5,
      status: 'pending',
      retryCount: 0,
      tenantId: TENANT,
    });
    expect(JSON.parse(queued.payload)).toMatchObject({ fullName: 'Mine edited again' });
    expect(rows[0]!.status).toBe('committed');
  });

  it('refuses keep_mine when the server has no copy to build on', async () => {
    const record = conflictRecord({ operation: 'create', serverSnapshot: null, serverVersion: 0 });
    const { deps } = setup([record]);

    expect(canKeepMine(record)).toBe(false);
    await expect(resolveConflict(deps, record, 'keep_mine')).rejects.toThrow('cannot be overwritten');
  });
});

describe('retryExhausted', () => {
  it('clears the error and retry count of exhausted records', async () => {
    const record = conflictRecord({ status: 'pending', retryCount: 5, lastError: 'network' });
    const { rows, deps } = setup([record]);

    await retryExhausted(deps.outbox, [record]);

    expect(rows[0]).toMatchObject({ retryCount: 0, lastError: null });
  });
});
