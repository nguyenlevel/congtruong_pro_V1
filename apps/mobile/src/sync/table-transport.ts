import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  type OutboxRecord,
  type PullBatch,
  type PullRequest,
  type PushResult,
  type SyncTransport,
} from '@partner-os/sync-engine';

const EPOCH = '1970-01-01T00:00:00.000Z';

export interface SyncRow {
  id: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface TableTransportSpec<TEntity extends { id: string }, TRow extends SyncRow> {
  recordType: string;
  table: string;
  /** Comma-separated columns; must include id, version, updated_at and deleted_at. */
  columns: string;
  /** Key under which the entity travels in a pulled payload, for example `worker`. */
  payloadKey: string;
  parse(payload: unknown): TEntity;
  toRow(entity: TEntity, version: number): Record<string, unknown>;
  entityFromRow(row: TRow): Record<string, unknown>;
}

function normalize(value: Record<string, unknown>): string {
  const keys = Object.keys(value).sort();
  return JSON.stringify(keys.map((key) => [key, value[key] ?? null]));
}

/**
 * Supabase sync transport for one table. Tenant isolation comes from RLS; this adapter never
 * filters by tenant itself.
 *
 * Push is idempotent. An update is applied only when the server still holds version-1. When the
 * write is refused (duplicate key, version mismatch) the server row is read back:
 *  - the row already holds this operation's data and version -> acknowledged (a replay after a lost ack);
 *  - otherwise the push is reported as a conflict with the server copy, never overwritten.
 *
 * Pull pages by (updated_at, id) so rows sharing a timestamp are never skipped across pages.
 */
export function createSupabaseTableTransport<TEntity extends { id: string }, TRow extends SyncRow>(
  client: SupabaseClient,
  spec: TableTransportSpec<TEntity, TRow>,
): SyncTransport {
  function payloadOf(row: TRow): unknown {
    return { [spec.payloadKey]: spec.entityFromRow(row), deleted: row.deleted_at !== null };
  }

  async function replayOrConflict(entity: TEntity, record: OutboxRecord<unknown>): Promise<PushResult> {
    const { data, error } = await client
      .from(spec.table)
      .select(spec.columns)
      .eq('id', entity.id)
      .maybeSingle();
    if (error) throw error;
    const row = data as unknown as TRow | null;
    if (!row) {
      return { acknowledged: false, serverVersion: 0, conflict: { serverVersion: 0, serverPayload: null } };
    }
    const sameData =
      record.operation === 'delete'
        ? row.deleted_at !== null
        : row.deleted_at === null &&
          normalize(spec.entityFromRow(row)) === normalize(spec.entityFromRow(spec.toRow(entity, record.version) as unknown as TRow));
    if (row.version >= record.version && sameData) {
      return { acknowledged: true, serverVersion: row.version };
    }
    return {
      acknowledged: false,
      serverVersion: row.version,
      conflict: { serverVersion: row.version, serverPayload: payloadOf(row) },
    };
  }

  async function pushRecord(record: OutboxRecord<unknown>): Promise<PushResult> {
    const entity = spec.parse(record.payload);

    if (record.operation === 'create') {
      const { data, error } = await client
        .from(spec.table)
        .insert(spec.toRow(entity, record.version))
        .select('version')
        .maybeSingle();
      if (error?.code === '23505') return replayOrConflict(entity, record);
      if (error) throw error;
      return { acknowledged: Boolean(data), serverVersion: (data as { version?: number } | null)?.version ?? record.version };
    }

    const patch =
      record.operation === 'delete'
        ? { deleted_at: record.clientTimestamp, version: record.version }
        : spec.toRow(entity, record.version);
    const { data, error } = await client
      .from(spec.table)
      .update(patch)
      .eq('id', entity.id)
      .eq('version', record.version - 1)
      .select('version')
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return { acknowledged: true, serverVersion: (data as { version: number }).version };
    }
    return replayOrConflict(entity, record);
  }

  return {
    async push(_operationId, record) {
      if (record.recordType !== spec.recordType) {
        throw new Error(`Unsupported record type for Supabase ${spec.table} push: ${record.recordType}`);
      }
      return pushRecord(record);
    },

    async pull(request: PullRequest): Promise<PullBatch> {
      const position = decodeKeysetCursor(request.cursor, EPOCH);
      const { data, error } = await client
        .from(spec.table)
        .select(spec.columns)
        .or(
          `updated_at.gt."${position.timestamp}",and(updated_at.eq."${position.timestamp}",id.gt."${position.id}")`,
        )
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(request.limit ?? 50);
      if (error) throw error;

      const rows = (data ?? []) as unknown as TRow[];
      const last = rows.at(-1);
      return {
        cursor: last
          ? encodeKeysetCursor({ timestamp: last.updated_at, id: last.id })
          : (request.cursor ?? encodeKeysetCursor(position)),
        records: rows.map((row) => ({ recordId: row.id, payload: payloadOf(row), version: row.version })),
      };
    },
  };
}
