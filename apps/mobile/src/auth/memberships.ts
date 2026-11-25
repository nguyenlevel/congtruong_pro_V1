import type { SupabaseClient } from '@supabase/supabase-js';

export interface TenantMembership {
  tenantId: string;
  name: string;
  /** Tenant-level role from the database; the UI uses it only to show or hide actions. */
  role: string;
}

interface MembershipRow {
  tenant_id: string;
  role: string;
  tenants: { name: string } | { name: string }[] | null;
}

/**
 * Lists tenants from database memberships through the authenticated client.
 * The result is the source of truth for the switcher; JWT or local storage is never used as evidence.
 */
export async function listMyTenants(client: SupabaseClient): Promise<TenantMembership[]> {
  const { data, error } = await client
    .from('memberships')
    .select('tenant_id, role, tenants(name)')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as MembershipRow[]).map((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    return { tenantId: row.tenant_id, name: tenant?.name ?? row.tenant_id, role: row.role };
  });
}

/** Asks the database which tenant is active for the current user. Returns null when none is valid. */
export async function getActiveTenantId(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.rpc('current_tenant_id');
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : null;
}
