/**
 * Conflict strategies. LWW is only the default for low-risk data
 * (e.g. UI preferences). Domain records must pick a stricter strategy.
 */
export const CONFLICT_RESOLUTION_STRATEGIES = [
  'LWW',
  'SERVER_WINS',
  'CLIENT_WINS',
  'FIELD_MERGE',
  'VERSION_CHECK',
  'MANUAL',
] as const;

export type ConflictResolutionStrategy = (typeof CONFLICT_RESOLUTION_STRATEGIES)[number];

export interface Conflict<TRecord> {
  recordId: string;
  recordType: string;
  localVersion: number;
  serverVersion: number;
  local: TRecord;
  server: TRecord;
}

/**
 * Maps a record type to the conflict strategy its business rules require.
 * Never silently overwrite incidents/inspections; approvals resolve server-side.
 */
export function strategyForRecordType(
  recordType: string,
  fallback: ConflictResolutionStrategy,
): ConflictResolutionStrategy {
  switch (recordType) {
    case 'incident':
    case 'inspection':
    case 'checklist':
    case 'worker':
    case 'attendance':
      return 'VERSION_CHECK';
    case 'approval':
      return 'SERVER_WINS';
    case 'ui_preference':
      return 'LWW';
    case 'audit_log':
      return 'CLIENT_WINS';
    default:
      return fallback;
  }
}
