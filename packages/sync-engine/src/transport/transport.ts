import type { OutboxRecord } from '../outbox/outbox';
import type { SyncCursor } from '../cursor/cursor';

export interface PushConflict {
  /** Version held by the server; 0 when the row is unknown or the conflict is a unique-key clash. */
  serverVersion: number;
  /** Server row in the same shape as a pulled record payload; null when there is none. */
  serverPayload: unknown | null;
}

export interface PushResult {
  acknowledged: boolean;
  serverVersion: number;
  /** Set when the server holds different data for the record (a real conflict, not a transient failure). */
  conflict?: PushConflict;
}

export interface PullBatch {
  cursor: SyncCursor;
  records: Array<{ recordId: string; payload: unknown; version: number }>;
}

export interface PullRequest {
  cursor: SyncCursor | null;
  recordType?: string;
  limit?: number;
}

/**
 * The sync transport abstracts the network boundary. Supabase over HTTPS is the
 * first implementation; the engine only depends on this interface.
 */
export interface SyncTransport {
  push<TRecord>(operationId: string, record: OutboxRecord<TRecord>): Promise<PushResult>;
  pull(request: PullRequest): Promise<PullBatch>;
}
