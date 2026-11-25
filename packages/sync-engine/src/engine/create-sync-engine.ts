import { createAuditEntry, type SyncAuditEntry, type SyncAction } from '../audit/audit';
import { advanceCursor, type SyncCursor } from '../cursor/cursor';
import type { OutboxRecord } from '../outbox/outbox';
import { DEFAULT_RETRY_POLICY, shouldRetry, type RetryPolicy } from '../retry/retry';
import type { PullBatch, SyncTransport } from '../transport/transport';
import { EMPTY_SYNC_STATS, type SyncEngine, type SyncStats } from './sync-engine';

/**
 * Port to the local outbox. Failed records stay pending so the next flush
 * retries them; the engine stops picking records once maxAttempts is reached.
 */
export interface SyncOutboxPort {
  pending(limit?: number): Promise<OutboxRecord<unknown>[]>;
  markCommitted(operationId: string): Promise<void>;
  markFailed(operationId: string, error: string): Promise<void>;
  /** Parks a record whose server copy differs. It is no longer returned by `pending`. */
  markConflict?(operationId: string, message: string, serverPayload: unknown | null, serverVersion: number): Promise<void>;
}

export interface CreateSyncEngineOptions {
  outbox: SyncOutboxPort;
  transport: SyncTransport;
  retryPolicy?: RetryPolicy;
  batchSize?: number;
  /** Applies pulled remote records to local storage before the cursor advances. */
  applyRemote?: (batch: PullBatch) => Promise<void>;
}

export function createSyncEngine(options: CreateSyncEngineOptions): SyncEngine {
  const { outbox, transport, applyRemote } = options;
  const policy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
  const batchSize = options.batchSize ?? 50;
  const listeners = new Set<(entry: SyncAuditEntry) => void>();

  const emitAudit = (entry: SyncAuditEntry): void => {
    listeners.forEach((listener) => listener(entry));
  };

  const audit = (
    action: SyncAction,
    record: Pick<OutboxRecord<unknown>, 'operationId' | 'recordType' | 'recordId'>,
    detail: string,
  ): void => {
    emitAudit(createAuditEntry({ ...record, action, detail }));
  };

  return {
    async flush(recordType) {
      const stats: SyncStats = { ...EMPTY_SYNC_STATS };
      const all = await outbox.pending(batchSize);
      const records = all.filter(
        (record) =>
          (recordType === undefined || record.recordType === recordType) &&
          record.retryCount < policy.maxAttempts,
      );
      // Operations on one record must reach the server in order: an exhausted, failed or
      // conflicting operation holds back the later operations for the same record.
      const blocked = new Set<string>(
        all.filter((record) => record.retryCount >= policy.maxAttempts).map((record) => record.recordId),
      );

      for (const record of records) {
        if (blocked.has(record.recordId)) continue;
        try {
          const result = await transport.push(record.operationId, record);
          if (!result.acknowledged && result.conflict && outbox.markConflict) {
            const message = `Conflict: server holds version ${result.conflict.serverVersion}`;
            await outbox.markConflict(
              record.operationId,
              message,
              result.conflict.serverPayload,
              result.conflict.serverVersion,
            );
            blocked.add(record.recordId);
            stats.conflicts += 1;
            audit('conflict', record, message);
            continue;
          }
          if (!result.acknowledged) {
            throw new Error(`Push not acknowledged (server version ${result.serverVersion})`);
          }
          await outbox.markCommitted(record.operationId);
          stats.pushed += 1;
          audit('commit', record, `committed at server version ${result.serverVersion}`);
        } catch (error) {
          blocked.add(record.recordId);
          const message = error instanceof Error ? error.message : String(error);
          await outbox.markFailed(record.operationId, message);
          stats.errors += 1;
          if (shouldRetry(record.retryCount + 1, policy)) {
            stats.retries += 1;
            audit('retry', record, message);
          }
          audit('push', record, `failed: ${message}`);
        }
      }

      return stats;
    },

    async pull(cursor: SyncCursor | null) {
      const batch = await transport.pull({ cursor, limit: batchSize });
      if (batch.records.length > 0) {
        await applyRemote?.(batch);
        audit('apply', { operationId: 'pull', recordType: '*', recordId: '*' }, `${batch.records.length} records`);
      }
      return advanceCursor(cursor, batch.cursor);
    },

    emitAudit,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
