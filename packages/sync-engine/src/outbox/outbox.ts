import type { OperationType } from '../operation';

export const OUTBOX_RECORD_STATUSES = ['pending', 'in_flight', 'failed', 'conflict', 'committed'] as const;

export type OutboxRecordStatus = (typeof OUTBOX_RECORD_STATUSES)[number];

export interface OutboxRecord<TRecord> {
  operationId: string;
  deviceId: string;
  recordType: string;
  recordId: string;
  operation: OperationType;
  payload: TRecord;
  version: number;
  clientTimestamp: string;
  retryCount: number;
  lastError: string | null;
  status: OutboxRecordStatus;
  createdAt: string;
}

export interface CreateOutboxRecordInput<TRecord> {
  operationId: string;
  deviceId: string;
  recordType: string;
  recordId: string;
  operation: OperationType;
  payload: TRecord;
  version: number;
  clientTimestamp?: string;
  createdAt?: string;
}

export function createOutboxRecord<TRecord>(
  input: CreateOutboxRecordInput<TRecord>,
): OutboxRecord<TRecord> {
  const now = input.clientTimestamp ?? new Date().toISOString();
  return {
    ...input,
    clientTimestamp: now,
    createdAt: input.createdAt ?? now,
    retryCount: 0,
    lastError: null,
    status: 'pending',
  };
}
