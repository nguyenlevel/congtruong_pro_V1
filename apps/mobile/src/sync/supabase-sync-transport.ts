import type { SupabaseClient } from '@supabase/supabase-js';
import { WorkerSchema } from '@partner-os/contracts';
import type { SyncTransport } from '@partner-os/sync-engine';
import { createSupabaseTableTransport, type SyncRow } from './table-transport';

interface WorkerRow extends SyncRow {
  tenant_id: string;
  project_id: string | null;
  code: string;
  full_name: string;
  phone_number: string;
  status: string;
}

type WorkerDto = ReturnType<typeof WorkerSchema.parse>;

export const WORKER_COLUMNS =
  'id, tenant_id, project_id, code, full_name, phone_number, status, version, updated_at, deleted_at';

/** Supabase sync transport for workers. Tenant isolation comes from RLS on public.workers. */
export function createSupabaseSyncTransport(client: SupabaseClient): SyncTransport {
  return createSupabaseTableTransport<WorkerDto, WorkerRow>(client, {
    recordType: 'worker',
    table: 'workers',
    columns: WORKER_COLUMNS,
    payloadKey: 'worker',
    parse: (payload) => WorkerSchema.parse(payload),
    toRow: (worker, version) => ({
      id: worker.id,
      tenant_id: worker.tenantId,
      project_id: worker.projectId ?? null,
      code: worker.code,
      full_name: worker.fullName,
      phone_number: worker.phoneNumber,
      status: worker.status,
      version,
    }),
    entityFromRow: (row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      code: row.code,
      fullName: row.full_name,
      phoneNumber: row.phone_number,
      status: row.status,
    }),
  });
}
