import type { Attendance, AttendanceApi, CreateAttendanceInput } from '@partner-os/contracts';
import { supabaseClient } from '../../../shared/supabase/client';

function toSnake(input: CreateAttendanceInput): Record<string, unknown> {
  return {
    tenant_id: input.tenantId,
    project_id: input.projectId ?? null,
    worker_id: input.workerId,
    work_date: input.workDate,
    status: input.status ?? 'PRESENT',
    check_in_at: input.checkInAt ?? null,
    check_out_at: input.checkOutAt ?? null,
    note: input.note ?? null,
  };
}

function toCamel(row: unknown): Attendance {
  const source = (row ?? {}) as Record<string, unknown>;
  return {
    id: String(source.id),
    tenantId: String(source.tenant_id),
    projectId: source.project_id === null ? null : String(source.project_id),
    workerId: String(source.worker_id),
    workDate: String(source.work_date),
    status: String(source.status) as Attendance['status'],
    checkInAt: source.check_in_at === null ? null : String(source.check_in_at),
    checkOutAt: source.check_out_at === null ? null : String(source.check_out_at),
    note: source.note === null ? null : String(source.note),
  };
}

export function createSupabaseAttendanceApi(): AttendanceApi {
  const client = supabaseClient();

  return {
    async list(query) {
      let builder = client.from('attendance').select('*');
      if (query.projectId !== undefined) {
        builder = builder.eq('project_id', query.projectId);
      }
      if (query.workerId !== undefined) {
        builder = builder.eq('worker_id', query.workerId);
      }
      if (query.workDate !== undefined) {
        builder = builder.eq('work_date', query.workDate);
      }
      if (query.status !== undefined) {
        builder = builder.eq('status', query.status);
      }
      const { data, error } = await builder;
      if (error) {
        throw new Error(`Failed to list attendance: ${error.message}`);
      }
      const rows = data as unknown as Array<Record<string, unknown>> | null;
      return (rows ?? []).map(toCamel);
    },

    async findById(id) {
      const { data, error } = await client
        .from('attendance')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to find attendance: ${error.message}`);
      }
      return data === null ? null : toCamel(data);
    },

    async create(input) {
      const { data, error } = await client.from('attendance').insert(toSnake(input)).select().single();
      if (error) {
        throw new Error(`Failed to create attendance: ${error.message}`);
      }
      return toCamel(data);
    },

    async update(id, patch) {
      const columns: Record<string, unknown> = {};
      if (patch.projectId !== undefined) columns['project_id'] = patch.projectId;
      if (patch.workDate !== undefined) columns['work_date'] = patch.workDate;
      if (patch.status !== undefined) columns['status'] = patch.status;
      if (patch.checkInAt !== undefined) columns['check_in_at'] = patch.checkInAt;
      if (patch.checkOutAt !== undefined) columns['check_out_at'] = patch.checkOutAt;
      if (patch.note !== undefined) columns['note'] = patch.note;
      const { data, error } = await client
        .from('attendance')
        .update(columns)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        throw new Error(`Failed to update attendance: ${error.message}`);
      }
      return toCamel(data);
    },

    async remove(id) {
      // Soft delete keeps the tenant audit trail; row stays for payroll history.
      const { error } = await client
        .from('attendance')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        throw new Error(`Failed to remove attendance: ${error.message}`);
      }
      return { id, deletedAt: new Date().toISOString() };
    },
  };
}