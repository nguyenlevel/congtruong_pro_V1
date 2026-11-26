begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id) values
  ('c1111111-1111-4111-8111-111111111111'),
  ('c2222222-2222-4222-8222-222222222222'),
  ('c4444444-4444-4444-8444-444444444444');

insert into public.tenants (id, name, code) values
  ('c0111111-1111-4111-8111-111111111111', 'TS Tenant 1', 'TS_TEST_T1'),
  ('c0222222-2222-4222-8222-222222222222', 'TS Tenant 2', 'TS_TEST_T2');

insert into public.memberships (user_id, tenant_id, role) values
  ('c1111111-1111-4111-8111-111111111111', 'c0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('c4444444-4444-4444-8444-444444444444', 'c0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('c4444444-4444-4444-8444-444444444444', 'c0222222-2222-4222-8222-222222222222', 'WORKER');

-- t1: a member of two tenants can select the second one; the RPC returns it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4444444-4444-4444-8444-444444444444","role":"authenticated","app_role":"WORKER","tenant_id":"c0111111-1111-4111-8111-111111111111"}', true);
select is(
  public.select_active_tenant('c0222222-2222-4222-8222-222222222222'),
  'c0222222-2222-4222-8222-222222222222'::uuid,
  'member of two tenants: select_active_tenant returns the selected tenant'
);

-- t2: selecting again updates the single row instead of creating a duplicate.
select public.select_active_tenant('c0111111-1111-4111-8111-111111111111');
select public.select_active_tenant('c0222222-2222-4222-8222-222222222222');
reset role;
select is(
  (select count(*) from public.user_active_tenant where user_id = 'c4444444-4444-4444-8444-444444444444'),
  1::bigint,
  'repeated selection keeps exactly one row per user'
);

-- t3: a user without membership cannot select a tenant.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated","app_role":"WORKER","tenant_id":"c0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.select_active_tenant('c0111111-1111-4111-8111-111111111111')$$,
  '42501',
  'not a member of this tenant',
  'non-member: select_active_tenant is refused'
);

-- t4: a forged tenant claim for a non-member resolves to NULL (no tenant access).
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated","app_role":"WORKER","tenant_id":"c0111111-1111-4111-8111-111111111111"}', true);
select is(public.current_tenant_id(), null::uuid, 'forged tenant claim without membership: current_tenant_id is NULL');

-- t5: direct writes to the selection table are not granted to authenticated.
select throws_ok(
  $$insert into public.user_active_tenant (user_id, tenant_id) values ('c2222222-2222-4222-8222-222222222222', 'c0111111-1111-4111-8111-111111111111')$$,
  '42501',
  null,
  'authenticated cannot write user_active_tenant directly'
);
reset role;

-- t6: anon cannot call the selection RPC.
select ok(
  not has_function_privilege('anon', 'public.select_active_tenant(uuid)', 'EXECUTE'),
  'anon has no EXECUTE on select_active_tenant'
);

-- t7-t8: the auth hook prefers the selected tenant; a single-tenant user falls back to its membership.
select is(
  public.custom_access_token_hook(jsonb_build_object('user_id', 'c4444444-4444-4444-8444-444444444444', 'claims', '{}'::jsonb)) -> 'claims' ->> 'tenant_id',
  'c0222222-2222-4222-8222-222222222222',
  'auth hook: selected tenant is placed in the JWT claim'
);
select is(
  public.custom_access_token_hook(jsonb_build_object('user_id', 'c1111111-1111-4111-8111-111111111111', 'claims', '{}'::jsonb)) -> 'claims' ->> 'tenant_id',
  'c0111111-1111-4111-8111-111111111111',
  'auth hook: single-tenant user keeps its only membership'
);

-- t9: the selected tenant is valid while membership exists.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4444444-4444-4444-8444-444444444444","role":"authenticated","app_role":"WORKER","tenant_id":"c0222222-2222-4222-8222-222222222222"}', true);
select is(
  public.current_tenant_id(),
  'c0222222-2222-4222-8222-222222222222'::uuid,
  'valid membership + matching claim: current_tenant_id returns the tenant'
);
reset role;

-- Revoke the second tenant membership while the JWT (claim tenant2) is still unexpired.
delete from public.memberships
where user_id = 'c4444444-4444-4444-8444-444444444444'
  and tenant_id = 'c0222222-2222-4222-8222-222222222222';

-- t10: the selection row is removed together with the revoked membership.
select is(
  (select count(*) from public.user_active_tenant where user_id = 'c4444444-4444-4444-8444-444444444444'),
  0::bigint,
  'revoked membership: selection row is removed by the foreign key cascade'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4444444-4444-4444-8444-444444444444","role":"authenticated","app_role":"WORKER","tenant_id":"c0222222-2222-4222-8222-222222222222"}', true);

-- t11: stale JWT claim for a revoked tenant is denied by the database.
select is(
  public.current_tenant_id(),
  null::uuid,
  'revoked membership + stale unexpired claim: current_tenant_id is NULL'
);

-- t12: the revoked user cannot select the revoked tenant again.
select throws_ok(
  $$select public.select_active_tenant('c0222222-2222-4222-8222-222222222222')$$,
  '42501',
  'not a member of this tenant',
  'revoked membership: select_active_tenant is refused'
);
reset role;

-- t13: after revocation the hook falls back to the remaining tenant, never the revoked one.
select is(
  public.custom_access_token_hook(jsonb_build_object('user_id', 'c4444444-4444-4444-8444-444444444444', 'claims', '{}'::jsonb)) -> 'claims' ->> 'tenant_id',
  'c0111111-1111-4111-8111-111111111111',
  'auth hook after revocation: falls back to the remaining membership'
);

select * from finish();
rollback;
