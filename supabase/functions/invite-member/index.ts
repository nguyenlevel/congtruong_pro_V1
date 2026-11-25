// invite-member: adds a person to a project by email.
// Flow: the caller's JWT is verified by the database (prepare_project_invite, add_project_member).
// The service-role key is used only to look up/create the auth user and the tenant membership of
// the caller's own tenant (WORKER or PROJECT_VIEWER). It is never returned to the client.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ROLES = ['WORKER', 'PROJECT_VIEWER'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function statusFor(code: string | undefined): number {
  if (code === '42501') return 403;
  if (code === '22023') return 400;
  return 500;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'missing authorization' });

  let input: { projectId?: unknown; projectCompanyId?: unknown; email?: unknown; role?: unknown };
  try {
    input = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (
    typeof input.projectId !== 'string' || !UUID.test(input.projectId) ||
    typeof input.projectCompanyId !== 'string' || !UUID.test(input.projectCompanyId) ||
    !EMAIL.test(email) || email.length > 254 ||
    typeof input.role !== 'string' || !(ROLES as readonly string[]).includes(input.role)
  ) {
    return json(400, { error: 'invalid request' });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const prepared = await caller.rpc('prepare_project_invite', {
    p_project_id: input.projectId,
    p_project_company_id: input.projectCompanyId,
    p_role: input.role,
  });
  if (prepared.error) {
    return json(statusFor(prepared.error.code), { error: prepared.error.message });
  }
  const tenantId = prepared.data as string;

  let invited = false;
  const found = await admin.rpc('find_user_id_by_email', { p_email: email });
  if (found.error) return json(500, { error: 'lookup failed' });
  let userId = found.data as string | null;
  if (!userId) {
    const created = await admin.auth.admin.inviteUserByEmail(email);
    if (created.error || !created.data.user) return json(400, { error: 'could not invite user' });
    userId = created.data.user.id;
    invited = true;
  }

  const granted = await admin.rpc('service_grant_tenant_membership', {
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_role: input.role,
  });
  if (granted.error) return json(500, { error: 'could not grant tenant membership' });

  const added = await caller.rpc('add_project_member', {
    p_project_id: input.projectId,
    p_project_company_id: input.projectCompanyId,
    p_user_id: userId,
    p_role: input.role,
  });
  if (added.error) {
    return json(statusFor(added.error.code), { error: added.error.message });
  }
  return json(200, { membershipId: added.data, userId, invited });
});
