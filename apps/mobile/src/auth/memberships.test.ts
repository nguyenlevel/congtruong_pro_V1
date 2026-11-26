import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listMyTenants } from './memberships';

const TENANT_A = 'd44c72ee-0000-4000-8000-00000000000a';
const TENANT_B = 'd44c72ee-0000-4000-8000-00000000000b';

describe('listMyTenants', () => {
  it('maps membership rows to tenant names from the database query', async () => {
    const client = {
      from(table: string) {
        expect(table).toBe('memberships');
        return {
          select(columns: string) {
            expect(columns).toContain('tenant_id');
            return {
              order: async () => ({
                data: [
                  { tenant_id: TENANT_A, role: 'SITE_MANAGER', tenants: { name: 'Công ty A' } },
                  { tenant_id: TENANT_B, role: 'WORKER', tenants: [{ name: 'Công ty B' }] },
                ],
                error: null,
              }),
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    expect(await listMyTenants(client)).toEqual([
      { tenantId: TENANT_A, name: 'Công ty A', role: 'SITE_MANAGER' },
      { tenantId: TENANT_B, name: 'Công ty B', role: 'WORKER' },
    ]);
  });

  it('propagates database errors instead of returning a stale list', async () => {
    const client = {
      from() {
        return {
          select() {
            return { order: async () => ({ data: null, error: { message: 'denied' } }) };
          },
        };
      },
    } as unknown as SupabaseClient;

    await expect(listMyTenants(client)).rejects.toThrow('denied');
  });
});
