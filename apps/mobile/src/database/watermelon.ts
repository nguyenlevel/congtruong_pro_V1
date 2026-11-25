import { Database, Q } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import type { Collection } from '@nozbe/watermelondb';
import type { Attendance, Worker } from '@partner-os/domain';
import type {
  LocalAttendanceStore,
  LocalConflictOutboxStore,
  LocalOutboxRecord,
  LocalWorkerStore,
  UnsyncedCount,
} from './index';
import { mobileSchema } from './schema';
import { mobileMigrations } from './migrations';
import { AttendanceModel } from './models/AttendanceModel';
import { SyncOutboxModel } from './models/SyncOutboxModel';
import { WorkerModel } from './models/WorkerModel';

function toWorker(model: WorkerModel): Worker {
  return {
    id: model.id,
    tenantId: model.tenantId,
    projectId: model.projectId,
    code: model.code,
    fullName: model.fullName,
    phoneNumber: model.phoneNumber,
    status: model.status as Worker['status'],
  };
}

function assignWorker(model: WorkerModel, worker: Worker): void {
  model.tenantId = worker.tenantId;
  model.projectId = worker.projectId;
  model.code = worker.code;
  model.fullName = worker.fullName;
  model.phoneNumber = worker.phoneNumber;
  model.status = worker.status;
  model.updatedAt = Date.now();
  model.version = model.version || 1;
  model.syncState = 'pending';
  model.deletedAt = null;
}

function createWorkerStore(database: Database): LocalWorkerStore {
  const collection = database.collections.get<WorkerModel>('workers');

  async function findModel(id: string): Promise<WorkerModel | null> {
    try {
      return await collection.find(id);
    } catch {
      return null;
    }
  }

  return {
    async list() {
      return (await collection.query().fetch()).map(toWorker);
    },
    async findById(id) {
      const model = await findModel(id);
      return model ? toWorker(model) : null;
    },
    async versionOf(id) {
      const model = await findModel(id);
      return model ? model.version || 1 : null;
    },
    async insert(worker) {
      await database.write(async () => {
        await collection.create((model) => {
          model._raw.id = worker.id;
          model.createdAt = Date.now();
          assignWorker(model, worker);
        });
      });
    },
    async update(id, patch) {
      return database.write(async () => {
        const model = await collection.find(id);
        await model.update((current) => {
          assignWorker(current, { ...toWorker(current), ...patch });
          current.version = (current.version || 1) + 1;
        });
        return toWorker(model);
      });
    },
    async remove(id) {
      await database.write(async () => {
        const model = await collection.find(id);
        await model.markAsDeleted();
      });
    },
    async applyRemote({ worker, version, deleted }) {
      await database.write(async () => {
        const model = await findModel(worker.id);
        if (deleted) {
          if (model) await model.destroyPermanently();
          return;
        }
        if (model) {
          await model.update((current) => {
            assignWorker(current, worker);
            current.version = version;
            current.syncState = 'synced';
          });
          return;
        }
        await collection.create((created) => {
          created._raw.id = worker.id;
          created.createdAt = Date.now();
          assignWorker(created, worker);
          created.version = version;
          created.syncState = 'synced';
        });
      });
    },
  };
}


function toAttendance(model: AttendanceModel): Attendance {
  return {
    id: model.id,
    tenantId: model.tenantId,
    projectId: model.projectId,
    workerId: model.workerId,
    workDate: model.workDate,
    status: model.status as Attendance['status'],
    checkInAt: model.checkInAt,
    checkOutAt: model.checkOutAt,
    note: model.note,
  };
}

function assignAttendance(model: AttendanceModel, attendance: Attendance): void {
  model.tenantId = attendance.tenantId;
  model.projectId = attendance.projectId;
  model.workerId = attendance.workerId;
  model.workDate = attendance.workDate;
  model.status = attendance.status;
  model.checkInAt = attendance.checkInAt;
  model.checkOutAt = attendance.checkOutAt;
  model.note = attendance.note;
  model.updatedAt = Date.now();
  model.version = model.version || 1;
  model.syncState = 'pending';
  model.deletedAt = null;
}

function createAttendanceStore(database: Database): LocalAttendanceStore {
  const collection = database.collections.get<AttendanceModel>('attendance');

  async function findModel(id: string): Promise<AttendanceModel | null> {
    try {
      return await collection.find(id);
    } catch {
      return null;
    }
  }

  return {
    async list() {
      return (await collection.query().fetch()).map(toAttendance);
    },
    async findById(id) {
      const model = await findModel(id);
      return model ? toAttendance(model) : null;
    },
    async versionOf(id) {
      const model = await findModel(id);
      return model ? model.version || 1 : null;
    },
    async insert(attendance) {
      await database.write(async () => {
        await collection.create((model) => {
          model._raw.id = attendance.id;
          model.createdAt = Date.now();
          assignAttendance(model, attendance);
        });
      });
    },
    async update(id, patch) {
      return database.write(async () => {
        const model = await collection.find(id);
        await model.update((current) => {
          assignAttendance(current, { ...toAttendance(current), ...patch });
          current.version = (current.version || 1) + 1;
        });
        return toAttendance(model);
      });
    },
    async remove(id) {
      await database.write(async () => {
        const model = await collection.find(id);
        await model.markAsDeleted();
      });
    },
    async applyRemote({ attendance, version, deleted }) {
      await database.write(async () => {
        const model = await findModel(attendance.id);
        if (deleted) {
          if (model) await model.destroyPermanently();
          return;
        }
        if (model) {
          await model.update((current) => {
            assignAttendance(current, attendance);
            current.version = version;
            current.syncState = 'synced';
          });
          return;
        }
        await collection.create((created) => {
          created._raw.id = attendance.id;
          created.createdAt = Date.now();
          assignAttendance(created, attendance);
          created.version = version;
          created.syncState = 'synced';
        });
      });
    },
  };
}


function createOutboxStore(database: Database): LocalConflictOutboxStore {
  const collection = database.collections.get<SyncOutboxModel>('sync_outbox');

  const toRecord = (model: SyncOutboxModel): LocalOutboxRecord => ({
    operationId: model.operationId,
    deviceId: model.deviceId,
    tenantId: model.tenantId,
    projectId: model.projectId ?? null,
    recordType: model.recordType,
    recordId: model.recordId,
    operation: model.operation as LocalOutboxRecord['operation'],
    payload: model.payload,
    version: model.version,
    retryCount: model.retryCount,
    lastError: model.lastError,
    status: model.status as LocalOutboxRecord['status'],
    createdAt: model.createdAt,
    serverSnapshot: model.serverSnapshot ?? null,
    serverVersion: model.serverVersion ?? null,
  });

  const scopeOf = (tenantId?: string) => (tenantId ? [Q.where('tenant_id', tenantId)] : []);

  return {
    async enqueue(record: LocalOutboxRecord) {
      await database.write(async () => {
        await collection.create((model) => {
          model.deviceId = record.deviceId;
          model.tenantId = record.tenantId;
          model.projectId = record.projectId;
          model.operationId = record.operationId;
          model.recordType = record.recordType;
          model.recordId = record.recordId;
          model.operation = record.operation;
          model.payload = record.payload;
          model.version = record.version;
          model.retryCount = record.retryCount;
          model.lastError = record.lastError;
          model.status = record.status;
          model.createdAt = record.createdAt;
          model.serverSnapshot = record.serverSnapshot ?? null;
          model.serverVersion = record.serverVersion ?? null;
        });
      });
    },
    async pending(limit = 50) {
      // A record with an unresolved conflict holds back its later operations: they must reach the
      // server in order, after the user decided what to do with the conflicting one.
      const conflicted = new Set(
        (await collection.query(Q.where('status', 'conflict')).fetch()).map((model) => model.recordId),
      );
      const records = await collection
        .query(Q.where('status', 'pending'), Q.sortBy('created_at', Q.asc))
        .fetch();
      return records
        .filter((model) => !conflicted.has(model.recordId))
        .slice(0, limit)
        .map(toRecord);
    },
    async countUnsynced(tenantId?: string): Promise<UnsyncedCount> {
      const unsynced = await collection
        .query(Q.where('status', Q.notEq('committed')), ...scopeOf(tenantId))
        .fetch();
      const conflict = unsynced.filter((model) => model.status === 'conflict').length;
      const failed = unsynced.filter(
        (model) => model.status !== 'conflict' && model.lastError !== null,
      ).length;
      return {
        pending: unsynced.length - failed - conflict,
        failed,
        conflict,
        total: unsynced.length,
      };
    },
    async markCommitted(operationId: string) {
      await updateOutbox(database, collection, operationId, (model) => {
        model.status = 'committed';
      });
    },
    // Failed records stay 'pending' so the next flush retries them; the sync engine caps attempts.
    async markFailed(operationId: string, error: string) {
      await updateOutbox(database, collection, operationId, (model) => {
        model.retryCount += 1;
        model.lastError = error;
      });
    },
    async markConflict(operationId, message, serverSnapshot, serverVersion) {
      await updateOutbox(database, collection, operationId, (model) => {
        model.status = 'conflict';
        model.lastError = message;
        model.serverSnapshot = serverSnapshot;
        model.serverVersion = serverVersion;
      });
    },
    async conflicts(tenantId?: string) {
      const records = await collection
        .query(Q.where('status', 'conflict'), ...scopeOf(tenantId), Q.sortBy('created_at', Q.asc))
        .fetch();
      return records.map(toRecord);
    },
    async exhausted(maxAttempts: number, tenantId?: string) {
      const records = await collection
        .query(
          Q.where('status', 'pending'),
          Q.where('retry_count', Q.gte(maxAttempts)),
          ...scopeOf(tenantId),
          Q.sortBy('created_at', Q.asc),
        )
        .fetch();
      return records.map(toRecord);
    },
    async resetRetries(operationId: string) {
      await updateOutbox(database, collection, operationId, (model) => {
        model.retryCount = 0;
        model.lastError = null;
      });
    },
    async discardRecordOperations(recordId: string) {
      return database.write(async () => {
        const rows = await collection
          .query(Q.where('record_id', recordId), Q.where('status', Q.notEq('committed')))
          .fetch();
        for (const row of rows) {
          await row.update((model) => {
            model.status = 'committed';
          });
        }
        return rows.length;
      });
    },
  };
}

async function updateOutbox(
  database: Database,
  collection: Collection<SyncOutboxModel>,
  operationId: string,
  update: (model: SyncOutboxModel) => void,
): Promise<void> {
  await database.write(async () => {
    const model = await collection.query(Q.where('operation_id', operationId)).fetch();
    const record = model[0] as SyncOutboxModel | undefined;
    if (record) {
      await record.update(update);
    }
  });
}

export function createWatermelonDatabase(databaseName = 'partner-os'): {
  workers: LocalWorkerStore;
  attendance: LocalAttendanceStore;
  outbox: ReturnType<typeof createOutboxStore>;
} {
  const adapter = new SQLiteAdapter({
    schema: mobileSchema,
    migrations: mobileMigrations,
    dbName: databaseName,
  });
  const database = new Database({
    adapter,
    modelClasses: [WorkerModel, AttendanceModel, SyncOutboxModel],
  });
  return {
    workers: createWorkerStore(database),
    attendance: createAttendanceStore(database),
    outbox: createOutboxStore(database),
  };
}