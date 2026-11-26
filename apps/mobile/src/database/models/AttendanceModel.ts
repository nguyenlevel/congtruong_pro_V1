import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class AttendanceModel extends Model {
  static table = 'attendance';

  @field('tenant_id') tenantId!: string;
  @field('project_id') projectId!: string | null;
  @field('worker_id') workerId!: string;
  @field('work_date') workDate!: string;
  @field('status') status!: string;
  @field('check_in_at') checkInAt!: string | null;
  @field('check_out_at') checkOutAt!: string | null;
  @field('note') note!: string | null;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('version') version!: number;
  @field('sync_status') syncState!: string;
  @field('deleted_at') deletedAt!: number | null;
}