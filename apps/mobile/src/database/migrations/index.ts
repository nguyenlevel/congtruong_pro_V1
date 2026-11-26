import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const mobileMigrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'sync_outbox',
          columns: [{ name: 'device_id', type: 'string', isIndexed: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'sync_outbox',
          columns: [
            { name: 'tenant_id', type: 'string', isIndexed: true },
            { name: 'project_id', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        createTable({
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
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'sync_outbox',
          columns: [
            { name: 'server_snapshot', type: 'string', isOptional: true },
            { name: 'server_version', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});