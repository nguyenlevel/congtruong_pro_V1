import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectSummary {
  id: string;
  siteName: string;
  status: string;
}

interface ProjectRow {
  id: string;
  site_name: string;
  status: string;
}

/**
 * Read-only project list visible to the signed-in user.
 * Visibility is decided by RLS on `projects` (owning tenant, participating company, or project membership),
 * so no tenant filter is applied here. Soft-deleted projects are excluded.
 */
export async function listVisibleProjects(client: SupabaseClient): Promise<ProjectSummary[]> {
  const { data, error } = await client
    .from('projects')
    .select('id, site_name, status')
    .is('deleted_at', null)
    .order('site_name', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ProjectRow[]).map((row) => ({
    id: row.id,
    siteName: row.site_name,
    status: row.status,
  }));
}
