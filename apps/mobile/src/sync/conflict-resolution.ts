import { AttendanceSchema, WorkerSchema } from '@partner-os/contracts';
import { createUuid } from '@partner-os/sync-engine';
import type {
  LocalAttendanceStore,
  LocalConflictOutboxStore,
  LocalOutboxRecord,
  LocalWorkerStore,
} from '../database';

export type ConflictChoice = 'keep_server' | 'keep_mine';

/** Reads and writes one record type locally. The sync layer stays independent of WatermelonDB. */
export interface RecordAdapter {
  /** Key under which the entity travels in the server snapshot, for example `worker`. */
  payloadKey: string;
  parseEntity(payload: unknown): { id: string };
  readLocal(id: string): Promise<{ id: string } | null>;
  /** Writes a server-confirmed state locally; deleted removes the row. */
  applyEntity(entity: { id: string }, version: number, deleted: boolean): Promise<void>;
}

export function createWorkerAdapter(store: LocalWorkerStore): RecordAdapter {
  return {
    payloadKey: 'worker',
    parseEntity: (payload) => WorkerSchema.parse(payload),
    readLocal: (id) => store.findById(id),
    applyEntity: (entity, version, deleted) =>
      store.applyRemote({ worker: WorkerSchema.parse(entity), version, deleted }),
  };
}

export function createAttendanceAdapter(store: LocalAttendanceStore): RecordAdapter {
  return {
    payloadKey: 'attendance',
    parseEntity: (payload) => AttendanceSchema.parse(payload),
    readLocal: (id) => store.findById(id),
    applyEntity: (entity, version, deleted) =>
      store.applyRemote({ attendance: AttendanceSchema.parse(entity), version, deleted }),
  };
}

export interface ConflictResolutionDeps {
  outbox: LocalConflictOutboxStore;
  adapters: Record<string, RecordAdapter>;
  now?: () => number;
  createOperationId?: () => string;
}

interface ServerSnapshot {
  entity: unknown;
  deleted: boolean;
}

function readSnapshot(record: LocalOutboxRecord, adapter: RecordAdapter): ServerSnapshot | null {
  if (!record.serverSnapshot) return null;
  const parsed = JSON.parse(record.serverSnapshot) as Record<string, unknown>;
  const entity = parsed[adapter.payloadKey];
  if (entity === undefined) return null;
  return { entity, deleted: parsed.deleted === true };
}

/** True when the user can overwrite the server copy: the server row exists. */
export function canKeepMine(record: LocalOutboxRecord): boolean {
  return Boolean(record.serverSnapshot) && (record.serverVersion ?? 0) > 0;
}

/**
 * Settles a conflict the user decided on. Nothing is overwritten silently:
 *  - keep_server discards every local operation of the record and restores the server copy
 *    (or removes the local row when the server has none);
 *  - keep_mine rebases the current local data on the server version and queues it again.
 */
export async function resolveConflict(
  deps: ConflictResolutionDeps,
  record: LocalOutboxRecord,
  choice: ConflictChoice,
): Promise<void> {
  const adapter = deps.adapters[record.recordType];
  if (!adapter) {
    throw new Error(`No adapter for record type ${record.recordType}`);
  }
  const snapshot = readSnapshot(record, adapter);

  if (choice === 'keep_server') {
    await deps.outbox.discardRecordOperations(record.recordId);
    if (snapshot) {
      await adapter.applyEntity(
        adapter.parseEntity(snapshot.entity),
        record.serverVersion ?? record.version,
        snapshot.deleted,
      );
    } else {
      await adapter.applyEntity(adapter.parseEntity(JSON.parse(record.payload)), record.version, true);
    }
    return;
  }

  if (!canKeepMine(record) || !snapshot) {
    throw new Error('The server has no copy of this record, so it cannot be overwritten');
  }
  const serverVersion = record.serverVersion as number;
  const local = await adapter.readLocal(record.recordId);
  const entity = local ?? adapter.parseEntity(JSON.parse(record.payload));
  const operation = !local && record.operation === 'delete' ? 'delete' : 'update';

  await deps.outbox.discardRecordOperations(record.recordId);
  await adapter.applyEntity(entity, serverVersion, false);
  await deps.outbox.enqueue({
    operationId: (deps.createOperationId ?? createUuid)(),
    deviceId: record.deviceId,
    tenantId: record.tenantId,
    projectId: record.projectId,
    recordType: record.recordType,
    recordId: record.recordId,
    operation,
    payload: JSON.stringify(entity),
    version: serverVersion + 1,
    retryCount: 0,
    lastError: null,
    status: 'pending',
    createdAt: (deps.now ?? Date.now)(),
    serverSnapshot: null,
    serverVersion: null,
  });
}

/** Makes records whose retries ran out eligible for a new push. */
export async function retryExhausted(
  outbox: LocalConflictOutboxStore,
  records: LocalOutboxRecord[],
): Promise<void> {
  for (const record of records) {
    await outbox.resetRetries(record.operationId);
  }
}
