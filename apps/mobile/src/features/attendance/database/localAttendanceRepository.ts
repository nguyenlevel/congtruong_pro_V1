import type { Attendance } from '@partner-os/domain';
import type { AttendanceRepository } from '@partner-os/database';
import { createOutboxRecord, type OperationType } from '@partner-os/sync-engine';
import { createUuid } from '@partner-os/shared-utils';
import type { LocalDatabase, LocalOutboxRecord, LocalAttendanceStore } from '../../../database';

export interface AttendanceLocalDatabase {
  attendance: LocalAttendanceStore;
  outbox: LocalDatabase['outbox'];
}

function toOutbox(
  deviceId: string,
  operation: OperationType,
  attendance: Attendance,
  version: number,
): LocalOutboxRecord {
  const record = createOutboxRecord({
    operationId: createUuid(),
    deviceId,
    recordType: 'attendance',
    recordId: attendance.id,
    operation,
    version,
    payload: attendance,
  });
  return {
    operationId: record.operationId,
    deviceId: record.deviceId,
    tenantId: attendance.tenantId,
    projectId: attendance.projectId ?? null,
    recordType: record.recordType,
    recordId: record.recordId,
    operation: record.operation,
    payload: JSON.stringify(record.payload),
    version: record.version,
    retryCount: 0,
    lastError: null,
    status: 'pending',
    createdAt: Date.parse(record.createdAt),
  };
}

/**
 * Offline-first attendance repository. Writes land in the local store first and
 * are queued to the sync outbox for the engine to push later.
 */
export function createLocalAttendanceRepository(
  db: AttendanceLocalDatabase,
  deviceId: string,
): AttendanceRepository {
  const { attendance, outbox } = db;

  return {
    scopeColumn: 'tenantId',

    async findById(id) {
      return attendance.findById(id);
    },

    async list(filter) {
      const all = await attendance.list();
      const tenantId = filter?.tenantId as string | undefined;
      const workerId = filter?.workerId as string | undefined;
      const workDate = filter?.workDate as string | undefined;
      return all.filter(
        (record) =>
          (tenantId === undefined || record.tenantId === tenantId) &&
          (workerId === undefined || record.workerId === workerId) &&
          (workDate === undefined || record.workDate === workDate),
      );
    },

    async listForScope(tenantId) {
      const all = await attendance.list();
      return all.filter((record) => record.tenantId === tenantId);
    },

    async listByWorker(workerId) {
      const all = await attendance.list();
      return all.filter((record) => record.workerId === workerId);
    },

    async listByWorkDate(workDate) {
      const all = await attendance.list();
      return all.filter((record) => record.workDate === workDate);
    },

    async create(input) {
      const attendanceRecord: Attendance = {
        ...input,
        id: createUuid(),
      };
      await attendance.insert(attendanceRecord);
      await outbox.enqueue(toOutbox(deviceId, 'create', attendanceRecord, 1));
      return attendanceRecord;
    },

    async update(id, patch) {
      const attendanceRecord = await attendance.update(id, patch);
      const version = (await attendance.versionOf(id)) ?? 1;
      await outbox.enqueue(toOutbox(deviceId, 'update', attendanceRecord, version));
      return attendanceRecord;
    },

    async remove(id) {
      const attendanceRecord = await attendance.findById(id);
      if (!attendanceRecord) return;
      const version = ((await attendance.versionOf(id)) ?? 1) + 1;
      await attendance.remove(id);
      await outbox.enqueue(toOutbox(deviceId, 'delete', attendanceRecord, version));
    },
  };
}