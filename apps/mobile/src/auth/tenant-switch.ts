import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocalSyncOutboxStore, UnsyncedCount } from '../database';

/** Thrown when the outbox still holds unsynced writes; carries the counts for the UI. */
export class UnsyncedBlockError extends Error {
  constructor(readonly counts: UnsyncedCount) {
    super('Còn dữ liệu chưa đồng bộ. Vui lòng đồng bộ xong trước khi đổi đơn vị.');
    this.name = 'UnsyncedBlockError';
  }
}

/**
 * Policy A (owner decision): refuse a tenant switch while any local write is unsynced
 * (pending, retry-scheduled failed, or in flight), so no record is carried into another tenant.
 * The count is over the whole outbox, not one tenant. The database still verifies membership.
 */
export async function switchActiveTenant(
  client: SupabaseClient,
  outbox: LocalSyncOutboxStore,
  tenantId: string,
): Promise<void> {
  const counts = await outbox.countUnsynced();
  if (counts.total > 0) throw new UnsyncedBlockError(counts);
  const { error } = await client.rpc('select_active_tenant', { p_tenant_id: tenantId });
  if (error) throw new Error(error.message);
  const { error: refreshError } = await client.auth.refreshSession();
  if (refreshError) throw new Error(refreshError.message);
}

