import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class SyncOutboxModel extends Model {
  static table = 'sync_outbox';

  @field('device_id') deviceId!: string;
  @field('tenant_id') tenantId!: string;
  @field('project_id') projectId!: string | null;
  @field('operation_id') operationId!: string;
  @field('record_type') recordType!: string;
  @field('record_id') recordId!: string;
  @field('operation') operation!: string;
  @field('payload') payload!: string;
  @field('version') version!: number;
  @field('retry_count') retryCount!: number;
  @field('last_error') lastError!: string | null;
  @field('status') status!: string;
  @field('created_at') createdAt!: number;
  @field('server_snapshot') serverSnapshot!: string | null;
  @field('server_version') serverVersion!: number | null;
}