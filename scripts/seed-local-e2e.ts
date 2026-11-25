/**
 * Seeds the LOCAL Supabase stack with the accounts and data the web E2E suite needs, so a clean
 * checkout can run `supabase db reset` -> `pnpm seed:e2e` -> `pnpm --filter @partner-os/web e2e`.
 *
 * Safety: refuses to run unless SUPABASE_URL points at localhost / 127.0.0.1. The password comes
 * from E2E_PASSWORD and is never stored. The service-role key comes from `supabase status -o env`.
 * Idempotent: safe to run repeatedly.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... E2E_PASSWORD=... pnpm seed:e2e
 */

const API_URL = (process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

const MAIN_TENANT = 'e2e00001-0000-4000-8000-000000000001';
const SUB_TENANT = 'e2e00002-0000-4000-8000-000000000002';
const PROJECT = 'e2e00003-0000-4000-8000-000000000003';

/** Fixed ids: the Playwright spec refers to the SUB worker by id. */
export const E2E_ACCOUNTS = {
  pmMain: { id: 'e2e10001-0000-4000-8000-000000000001', email: 'pm.main@local.test', tenant: MAIN_TENANT, role: 'PROJECT_MANAGER' },
  pmSub: { id: 'e2e10002-0000-4000-8000-000000000002', email: 'pm.sub@local.test', tenant: SUB_TENANT, role: 'PROJECT_MANAGER' },
  workerSub: { id: 'e2e10003-0000-4000-8000-000000000003', email: 'worker.sub@local.test', tenant: SUB_TENANT, role: 'WORKER' },
  siteMain: { id: 'e2e10004-0000-4000-8000-000000000004', email: 'site.main@local.test', tenant: MAIN_TENANT, role: 'SITE_MANAGER' },
} as const;

function assertLocal(): void {
  const host = new URL(API_URL).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Refusing to seed ${host}: this script only runs against a local Supabase stack.`);
  }
  if (!SERVICE_KEY) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY (see `supabase status -o env`).');
  if (PASSWORD.length < 8) throw new Error('Set E2E_PASSWORD (at least 8 characters).');
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function call(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!response.ok && response.status !== 422) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status} ${await response.text()}`);
  }
  return response;
}

async function ensureUser(account: { id: string; email: string }): Promise<void> {
  const response = await call('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ id: account.id, email: account.email, password: PASSWORD, email_confirm: true }),
  });
  if (response.status === 422) {
    // Already registered: make sure the password matches this run.
    const update = await fetch(`${API_URL}/auth/v1/admin/users/${account.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password: PASSWORD }),
    });
    if (!update.ok) {
      throw new Error(
        `${account.email} exists with a different id. Run \`supabase db reset\` for a clean local database, then seed again.`,
      );
    }
  }
}

async function upsert(table: string, rows: unknown[], conflict: string): Promise<void> {
  await call(`/rest/v1/${table}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

async function main(): Promise<void> {
  assertLocal();

  for (const account of Object.values(E2E_ACCOUNTS)) await ensureUser(account);

  await upsert('tenants', [
    { id: MAIN_TENANT, name: 'E2E Main Contractor', code: 'E2E_MAIN' },
    { id: SUB_TENANT, name: 'E2E Subcontractor', code: 'E2E_SUB' },
  ], 'id');
  await upsert(
    'memberships',
    Object.values(E2E_ACCOUNTS).map((a) => ({ user_id: a.id, tenant_id: a.tenant, role: a.role })),
    'user_id,tenant_id',
  );
  await upsert('projects', [{ id: PROJECT, tenant_id: MAIN_TENANT, site_name: 'Local Test Site A', address: 'Hanoi' }], 'id');
  await upsert('project_companies', [
    { project_id: PROJECT, tenant_id: MAIN_TENANT, participation_type: 'MAIN_CONTRACTOR', status: 'ACTIVE' },
    { project_id: PROJECT, tenant_id: SUB_TENANT, participation_type: 'SUBCONTRACTOR', status: 'ACTIVE' },
  ], 'project_id,tenant_id');
  await upsert('project_memberships', [
    { user_id: E2E_ACCOUNTS.pmMain.id, project_id: PROJECT, tenant_id: MAIN_TENANT, role: 'PROJECT_MANAGER', scope: 'PROJECT' },
    { user_id: E2E_ACCOUNTS.pmSub.id, project_id: PROJECT, tenant_id: SUB_TENANT, role: 'PROJECT_MANAGER', scope: 'PROJECT_COMPANY' },
  ], 'user_id,project_id,tenant_id,role');

  console.log('E2E seed complete: pm.main@local.test, pm.sub@local.test, worker.sub@local.test, project "Local Test Site A".');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
