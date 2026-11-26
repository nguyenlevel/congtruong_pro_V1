import type { Worker } from '@partner-os/domain';
import type { WorkerRepository, WorkerStatusFilter } from '@partner-os/database';
import { createOutboxRecord, type OperationType } from '@partner-os/sync-engine';
import { createUuid } from '@partner-os/shared-utils';
import type { LocalDatabase, LocalOutboxRecord, LocalWorkerStore } from '../../../database';

export interface WorkerLocalDatabase {
  workers: LocalWorkerStore;
  outbox: LocalDatabase['outbox'];
}

function toOutbox(
  deviceId: string,
  operation: OperationType,
  worker: Worker,
  version: number,
): LocalOutboxRecord {
  const record = createOutboxRecord({
    operationId: createUuid(),
    deviceId,
    recordType: 'worker',
    recordId: worker.id,
    operation,
    version,
    payload: worker,
  });
  return {
    operationId: record.operationId,
    deviceId: record.deviceId,
    tenantId: worker.tenantId,
    projectId: worker.projectId ?? null,
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
 * Offline-first worker repository. Writes land in the local store first and
 * are queued to the sync outbox for the engine to push later.
 */
export function createLocalWorkerRepository(
  db: WorkerLocalDatabase,
  deviceId: string,
): WorkerRepository {
  const { workers, outbox } = db;

  return {
    scopeColumn: 'tenantId',

    async findById(id) {
      return workers.findById(id);
    },

    async list(filter) {
      const all = await workers.list();
      const tenantId = filter?.tenantId as string | undefined;
      if (tenantId !== undefined) {
        return all.filter((worker) => worker.tenantId === tenantId);
      }
      return all;
    },

    async listForScope(tenantId) {
      const all = await workers.list();
      return all.filter((worker) => worker.tenantId === tenantId);
    },

    async listByProject(projectId) {
      const all = await workers.list();
      return all.filter((worker) => worker.projectId === projectId);
    },

    async listByStatus(status: WorkerStatusFilter) {
      const all = await workers.list();
      return all.filter((worker) => worker.status === status);
    },

    async create(input) {
      const worker: Worker = {
        ...input,
        id: createUuid(),
      };
      await workers.insert(worker);
      await outbox.enqueue(toOutbox(deviceId, 'create', worker, 1));
      return worker;
    },

    async update(id, patch) {
      const worker = await workers.update(id, patch);
      const version = (await workers.versionOf(id)) ?? 1;
      await outbox.enqueue(toOutbox(deviceId, 'update', worker, version));
      return worker;
    },

    async remove(id) {
      const worker = await workers.findById(id);
      if (!worker) return;
      const version = ((await workers.versionOf(id)) ?? 1) + 1;
      await workers.remove(id);
      await outbox.enqueue(toOutbox(deviceId, 'delete', worker, version));
    },
  };
}
