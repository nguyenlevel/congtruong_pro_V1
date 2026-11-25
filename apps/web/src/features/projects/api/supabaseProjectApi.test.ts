import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseProjectApi } from './supabaseProjectApi';

const TENANT = 'd44c72ee-0000-4000-8000-000000000001';
const OTHER_TENANT = 'd44c72ee-0000-4000-8000-000000000002';

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

function fakeClient(result: { data: unknown; error: { message: string } | null }): {
  client: SupabaseClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'order']) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return chain;
      };
    }
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return chain;
  };
  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ table: 'rpc', method: fn, args: [args] });
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('supabaseProjectApi', () => {
  it('lists non-deleted projects returned by RLS (owned or participating) and maps them', async () => {
    const { client, calls } = fakeClient({
      data: [
        { id: 'p1', tenant_id: TENANT, site_name: 'Site A', address: '', status: 'ACTIVE', deleted_at: null },
        { id: 'p2', tenant_id: OTHER_TENANT, site_name: 'Participating', address: '', status: 'ACTIVE', deleted_at: null },
      ],
      error: null,
    });

    const projects = await createSupabaseProjectApi(client).listProjects();

    expect(projects).toEqual([
      { id: 'p1', tenantId: TENANT, siteName: 'Site A', address: '', status: 'ACTIVE' },
      { id: 'p2', tenantId: OTHER_TENANT, siteName: 'Participating', address: '', status: 'ACTIVE' },
    ]);
    expect(calls).toContainEqual({ table: 'projects', method: 'is', args: ['deleted_at', null] });
  });

  it('creates a project through the create_project RPC', async () => {
    const { client, calls } = fakeClient({ data: 'project-id', error: null });

    const id = await createSupabaseProjectApi(client).createProject({ siteName: 'Site X', address: 'Hanoi' });

    expect(id).toBe('project-id');
    expect(calls).toContainEqual({
      table: 'rpc',
      method: 'create_project',
      args: [{ p_site_name: 'Site X', p_address: 'Hanoi', p_organization_id: null }],
    });
  });

  it('surfaces create_project database errors', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'not allowed to create projects' } });

    await expect(createSupabaseProjectApi(client).createProject({ siteName: 'X' })).rejects.toThrow(
      'not allowed to create projects',
    );
  });

  it('invites a member by email through the invite-member Edge Function', async () => {
    const invoked: Array<{ name: string; body: unknown }> = [];
    const client = {
      functions: {
        invoke: (name: string, options: { body: unknown }) => {
          invoked.push({ name, body: options.body });
          return Promise.resolve({ data: { membershipId: 'm1', userId: 'u1', invited: true }, error: null });
        },
      },
    } as unknown as SupabaseClient;

    const result = await createSupabaseProjectApi(client).inviteProjectMember({
      projectId: 'p1',
      projectCompanyId: 'c1',
      email: 'a@b.co',
      role: 'WORKER',
    });

    expect(result).toEqual({ membershipId: 'm1', userId: 'u1', invited: true });
    expect(invoked).toEqual([
      { name: 'invite-member', body: { projectId: 'p1', projectCompanyId: 'c1', email: 'a@b.co', role: 'WORKER' } },
    ]);
  });

  it('reports the JSON error returned by the Edge Function', async () => {
    const client = {
      functions: {
        invoke: () =>
          Promise.resolve({
            data: null,
            error: {
              message: 'Edge Function returned a non-2xx status code',
              context: new Response(JSON.stringify({ error: 'invites can only target the caller\'s own company' }), { status: 403 }),
            },
          }),
      },
    } as unknown as SupabaseClient;

    await expect(
      createSupabaseProjectApi(client).inviteProjectMember({ projectId: 'p', projectCompanyId: 'c', email: 'a@b.co', role: 'WORKER' }),
    ).rejects.toThrow("invites can only target the caller's own company");
  });

  it('surfaces database errors instead of returning an empty list', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'permission denied' } });

    await expect(createSupabaseProjectApi(client).listProjects()).rejects.toThrow(
      'Failed to list projects: permission denied',
    );
  });

  it('maps project companies with participation type and status', async () => {
    const { client, calls } = fakeClient({
      data: [
        { id: 'c1', project_id: 'p1', tenant_id: TENANT, participation_type: 'MAIN_CONTRACTOR', status: 'ACTIVE' },
        { id: 'c2', project_id: 'p1', tenant_id: OTHER_TENANT, participation_type: 'SUBCONTRACTOR', status: 'SUSPENDED' },
      ],
      error: null,
    });

    const companies = await createSupabaseProjectApi(client).listProjectCompanies('p1');

    expect(companies.map((c) => [c.participationType, c.status])).toEqual([
      ['MAIN_CONTRACTOR', 'ACTIVE'],
      ['SUBCONTRACTOR', 'SUSPENDED'],
    ]);
    expect(calls).toContainEqual({ table: 'project_companies', method: 'eq', args: ['project_id', 'p1'] });
  });

  it('adds a subcontractor company through the add_project_company RPC', async () => {
    const { client, calls } = fakeClient({ data: 'c3', error: null });

    const id = await createSupabaseProjectApi(client).addProjectCompany({
      projectId: 'p1',
      tenantId: OTHER_TENANT,
      participationType: 'SUBCONTRACTOR',
    });

    expect(id).toBe('c3');
    expect(calls).toContainEqual({
      table: 'rpc',
      method: 'add_project_company',
      args: [{ p_project_id: 'p1', p_tenant_id: OTHER_TENANT, p_participation_type: 'SUBCONTRACTOR' }],
    });
  });

  it('suspends and ends a company via update_project_company, leaving unchanged fields null', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    const api = createSupabaseProjectApi(client);

    await api.updateProjectCompany({ projectCompanyId: 'c2', status: 'SUSPENDED' });
    await api.updateProjectCompany({ projectCompanyId: 'c2', status: 'ENDED' });

    expect(calls.filter((c) => c.table === 'rpc').map((c) => c.args[0])).toEqual([
      { p_project_company_id: 'c2', p_participation_type: null, p_status: 'SUSPENDED' },
      { p_project_company_id: 'c2', p_participation_type: null, p_status: 'ENDED' },
    ]);
  });

  it('surfaces RPC rejections (for example a PROJECT_VIEWER attempt) instead of succeeding silently', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'insufficient privilege' } });

    await expect(
      createSupabaseProjectApi(client).addProjectCompany({
        projectId: 'p1',
        tenantId: OTHER_TENANT,
        participationType: 'OTHER',
      }),
    ).rejects.toThrow('Failed to add project company: insufficient privilege');
  });

  it('lists project members of the project from project_memberships and maps them', async () => {
    const { client, calls } = fakeClient({
      data: [{ id: 'm1', project_id: 'p1', tenant_id: TENANT, user_id: 'u1', role: 'WORKER' }],
      error: null,
    });

    const members = await createSupabaseProjectApi(client).listProjectMembers('p1');

    expect(members).toEqual([{ id: 'm1', projectId: 'p1', tenantId: TENANT, userId: 'u1', role: 'WORKER' }]);
    expect(calls).toContainEqual({ table: 'project_memberships', method: 'eq', args: ['project_id', 'p1'] });
  });

  it('adds a member through add_project_member with the company, user and role', async () => {
    const { client, calls } = fakeClient({ data: 'm2', error: null });

    const id = await createSupabaseProjectApi(client).addProjectMember({
      projectId: 'p1',
      projectCompanyId: 'c2',
      userId: 'u2',
      role: 'PROJECT_VIEWER',
    });

    expect(id).toBe('m2');
    expect(calls).toContainEqual({
      table: 'rpc',
      method: 'add_project_member',
      args: [{ p_project_id: 'p1', p_project_company_id: 'c2', p_user_id: 'u2', p_role: 'PROJECT_VIEWER' }],
    });
  });

  it('changes a role and revokes a membership through the member RPCs', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    const api = createSupabaseProjectApi(client);

    await api.updateProjectMemberRole({ membershipId: 'm1', role: 'PROJECT_VIEWER' });
    await api.removeProjectMember('m1');

    expect(calls.filter((c) => c.table === 'rpc')).toEqual([
      { table: 'rpc', method: 'update_project_member_role', args: [{ p_project_membership_id: 'm1', p_role: 'PROJECT_VIEWER' }] },
      { table: 'rpc', method: 'remove_project_member', args: [{ p_project_membership_id: 'm1' }] },
    ]);
  });

  it('surfaces member RPC rejections such as an over-privileged role change', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'cannot grant role' } });

    await expect(
      createSupabaseProjectApi(client).updateProjectMemberRole({ membershipId: 'm1', role: 'WORKER' }),
    ).rejects.toThrow('Failed to update project member: cannot grant role');
  });
});
