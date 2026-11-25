/**
 * WatermelonDB local schema (contract section 14).
 * The mobile app is the only place WatermelonDB is referenced directly.
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const mobileSchema = appSchema({
  version: 5,
  tables: [
    tableSchema({
      name: 'workers',
      columns: [
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'project_id', type: 'string', isOptional: true },
        { name: 'code', type: 'string' },
        { name: 'full_name', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'version', type: 'number' },
        { name: 'sync_status', type: 'string' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'attendance',
      columns: [
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'project_id', type: 'string', isOptional: true },
        { name: 'worker_id', type: 'string', isIndexed: true },
        { name: 'work_date', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'check_in_at', type: 'string', isOptional: true },
        { name: 'check_out_at', type: 'string', isOptional: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'version', type: 'number' },
        { name: 'sync_status', type: 'string' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'sync_outbox',
      columns: [
        { name: 'device_id', type: 'string', isIndexed: true },
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'project_id', type: 'string', isOptional: true },
        { name: 'operation_id', type: 'string' },
        { name: 'record_type', type: 'string', isIndexed: true },
        { name: 'record_id', type: 'string', isIndexed: true },
        { name: 'operation', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'version', type: 'number' },
        { name: 'retry_count', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'server_snapshot', type: 'string', isOptional: true },
        { name: 'server_version', type: 'number', isOptional: true },
      ],
    }),
  ],
});
