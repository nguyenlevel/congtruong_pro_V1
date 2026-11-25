import { describe, expect, it } from 'vitest';
import type { Attendance } from '@partner-os/domain';
import type { LocalAttendanceStore, LocalOutboxRecord, LocalSyncOutboxStore } from '../../../database';
import { createLocalAttendanceRepository } from '../database/localAttendanceRepository';
import { createAttendanceOffline } from './offline-attendance';

interface FakeDb {
  rows: Attendance[];
  outboxRecords: LocalOutboxRecord[];
  attendance: LocalAttendanceStore;
  outbox: LocalSyncOutboxStore;
}

function fakeDatabase(): FakeDb {
  const rows: Attendance[] = [];
  const outboxRecords: LocalOutboxRecord[] = [];
  const versions = new Map<string, number>();

  const attendance: LocalAttendanceStore = {
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
        throw new Error(`attendance not found: ${id}`);
      }
      const updated = { ...rows[index]!, ...patch, id } as Attendance;
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

  return { rows, outboxRecords, attendance, outbox };
}

const TENANT = 'd44c72ee-0000-4000-8000-000000000001';
const WORKER = '22222222-2222-4222-8222-222222222222';

describe('createAttendanceOffline (offline-first)', () => {
  it('validates, persists to the local store and enqueues a create operation', async () => {
    const db = fakeDatabase();
    const repo = createLocalAttendanceRepository(
      { attendance: db.attendance, outbox: db.outbox },
      'device-1',
    );

    const record = await createAttendanceOffline(repo, {
      tenantId: TENANT,
      projectId: null,
      workerId: WORKER,
      workDate: '2026-11-20',
    });

    expect(record.id).toHaveLength(36);
    expect(record.status).toBe('PRESENT');
    expect(db.rows).toHaveLength(1);
    expect(db.outboxRecords).toHaveLength(1);

    const outboxRecord = db.outboxRecords[0]!;
    expect(outboxRecord.recordType).toBe('attendance');
    expect(outboxRecord.operation).toBe('create');
    expect(outboxRecord.deviceId).toBe('device-1');
    const payload = JSON.parse(outboxRecord.payload) as Attendance;
    expect(payload.workDate).toBe('2026-11-20');
    expect(payload.tenantId).toBe(TENANT);
  });

  it('rejects invalid input at the boundary and persists nothing', async () => {
    const db = fakeDatabase();
    const repo = createLocalAttendanceRepository(
      { attendance: db.attendance, outbox: db.outbox },
      'device-1',
    );

    await expect(
      createAttendanceOffline(repo, {
        tenantId: '',
        projectId: null,
        workerId: 'nope',
        workDate: 'bad-date',
      }),
    ).rejects.toThrow();

    expect(db.rows).toHaveLength(0);
    expect(db.outboxRecords).toHaveLength(0);
  });

  it('rejects a check-out before the check-in', async () => {
    const db = fakeDatabase();
    const repo = createLocalAttendanceRepository(
      { attendance: db.attendance, outbox: db.outbox },
      'device-1',
    );

    await expect(
      createAttendanceOffline(repo, {
        tenantId: TENANT,
        projectId: null,
        workerId: WORKER,
        workDate: '2026-11-20',
        checkInAt: '2026-11-20T09:00:00.000Z',
        checkOutAt: '2026-11-20T08:00:00.000Z',
      }),
    ).rejects.toThrow();

    expect(db.rows).toHaveLength(0);
    expect(db.outboxRecords).toHaveLength(0);
  });

  it('advances the outbox version on each local write so pushes match the server chain', async () => {
    const db = fakeDatabase();
    const repo = createLocalAttendanceRepository(
      { attendance: db.attendance, outbox: db.outbox },
      'device-1',
    );

    const record = await createAttendanceOffline(repo, {
      tenantId: TENANT,
      projectId: null,
      workerId: WORKER,
      workDate: '2026-11-20',
    });
    await repo.update(record.id, { note: 'late entry' });
    await repo.update(record.id, { status: 'HALF_DAY' });

    expect(db.outboxRecords.map((row) => row.version)).toEqual([1, 2, 3]);
    expect(db.outboxRecords.map((row) => row.operation)).toEqual(['create', 'update', 'update']);
  });
});