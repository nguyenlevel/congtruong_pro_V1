import type { SupabaseClient } from '@supabase/supabase-js';
import { AttendanceSchema } from '@partner-os/contracts';
import type { SyncTransport } from '@partner-os/sync-engine';
import { createSupabaseTableTransport, type SyncRow } from './table-transport';

interface AttendanceRow extends SyncRow {
  tenant_id: string;
  project_id: string | null;
  worker_id: string;
  work_date: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  note: string | null;
}

type AttendanceDto = ReturnType<typeof AttendanceSchema.parse>;

export const ATTENDANCE_COLUMNS =
  'id, tenant_id, project_id, worker_id, work_date, status, check_in_at, check_out_at, note, version, updated_at, deleted_at';

/** Supabase sync transport for attendance. Tenant isolation comes from RLS on public.attendance. */
export function createSupabaseAttendanceTransport(client: SupabaseClient): SyncTransport {
  return createSupabaseTableTransport<AttendanceDto, AttendanceRow>(client, {
    recordType: 'attendance',
    table: 'attendance',
    columns: ATTENDANCE_COLUMNS,
    payloadKey: 'attendance',
    parse: (payload) => AttendanceSchema.parse(payload),
    toRow: (attendance, version) => ({
      id: attendance.id,
      tenant_id: attendance.tenantId,
      project_id: attendance.projectId ?? null,
      worker_id: attendance.workerId,
      work_date: attendance.workDate,
      status: attendance.status,
      check_in_at: attendance.checkInAt,
      check_out_at: attendance.checkOutAt,
      note: attendance.note,
      version,
    }),
    entityFromRow: (row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      workerId: row.worker_id,
      workDate: row.work_date,
      status: row.status,
      checkInAt: row.check_in_at,
      checkOutAt: row.check_out_at,
      note: row.note,
    }),
  });
}
