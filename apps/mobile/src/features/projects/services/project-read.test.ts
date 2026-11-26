import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listVisibleProjects } from './project-read';

function clientReturning(result: { data: unknown; error: { message: string } | null }) {
  const order = vi.fn().mockResolvedValue(result);
  const is = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ is });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, from, is };
}

describe('listVisibleProjects', () => {
  it('reads projects without a tenant filter, excludes soft-deleted rows and maps fields', async () => {
    const { client, from, is } = clientReturning({
      data: [{ id: 'p1', site_name: 'Site A', status: 'ACTIVE' }],
      error: null,
    });

    const rows = await listVisibleProjects(client);

    expect(from).toHaveBeenCalledWith('projects');
    expect(is).toHaveBeenCalledWith('deleted_at', null);
    expect(rows).toEqual([{ id: 'p1', siteName: 'Site A', status: 'ACTIVE' }]);
  });

  it('throws the database error message instead of returning an empty list', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'permission denied' } });
    await expect(listVisibleProjects(client)).rejects.toThrow('permission denied');
  });
});
