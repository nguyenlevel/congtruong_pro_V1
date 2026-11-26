begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id) values
  ('d1111111-1111-4111-8111-111111111111'),
  ('d2222222-2222-4222-8222-222222222222'),
  ('d3333333-3333-4333-8333-333333333333'),
  ('d4444444-4444-4444-8444-444444444444');

insert into public.tenants (id, name, code) values
  ('d0111111-1111-4111-8111-111111111111', 'PCM Main', 'PCM_TEST_MAIN'),
  ('d0222222-2222-4222-8222-222222222222', 'PCM Sub', 'PCM_TEST_SUB');

insert into public.memberships (user_id, tenant_id, role) values
  ('d1111111-1111-4111-8111-111111111111', 'd0111111-1111-4111-8111-111111111111', 'SITE_MANAGER'),
  ('d2222222-2222-4222-8222-222222222222', 'd0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('d4444444-4444-4444-8444-444444444444', 'd0222222-2222-4222-8222-222222222222', 'WORKER');

insert into public.projects (id, tenant_id, site_name) values
  ('d0a11111-1111-4111-8111-111111111111', 'd0111111-1111-4111-8111-111111111111', 'PCM Active Site'),
  ('d0a22222-2222-4222-8222-222222222222', 'd0111111-1111-4111-8111-111111111111', 'PCM Deleted Site');

insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values
  ('d1111111-1111-4111-8111-111111111111', 'd0a11111-1111-4111-8111-111111111111', 'd0111111-1111-4111-8111-111111111111', 'SITE_MANAGER', 'PROJECT'),
  ('d1111111-1111-4111-8111-111111111111', 'd0a22222-2222-4222-8222-222222222222', 'd0111111-1111-4111-8111-111111111111', 'SITE_MANAGER', 'PROJECT');

update public.projects set deleted_at = now() where id = 'd0a22222-2222-4222-8222-222222222222';

-- t1: the MAIN_CONTRACTOR manager adds a subcontractor company.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SITE_MANAGER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
select isnt(
  public.add_project_company('d0a11111-1111-4111-8111-111111111111', 'd0222222-2222-4222-8222-222222222222', 'SUBCONTRACTOR'),
  null::uuid,
  'manager: add_project_company returns the new company id'
);
reset role;

-- t2: the add is audited.
select is(
  (select count(*) from public.audit_log where action = 'project_company.added'),
  1::bigint,
  'add_project_company writes a project_company.added audit row'
);

-- t3: a WORKER of the main contractor cannot manage companies.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2222222-2222-4222-8222-222222222222","role":"authenticated","app_role":"WORKER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.add_project_company('d0a11111-1111-4111-8111-111111111111', 'd0222222-2222-4222-8222-222222222222', 'OTHER')$$,
  '42501',
  'not allowed to manage this project',
  'worker: add_project_company is refused'
);

-- t4: a user with no membership cannot manage companies.
select set_config('request.jwt.claims', '{"sub":"d3333333-3333-4333-8333-333333333333","role":"authenticated","app_role":"WORKER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.add_project_company('d0a11111-1111-4111-8111-111111111111', 'd0222222-2222-4222-8222-222222222222', 'OTHER')$$,
  '42501',
  'not allowed to manage this project',
  'outsider: add_project_company is refused'
);
reset role;

-- t5: MAIN_CONTRACTOR cannot be added as a second participation type.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SITE_MANAGER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.add_project_company('d0a11111-1111-4111-8111-111111111111', 'd0222222-2222-4222-8222-222222222222', 'MAIN_CONTRACTOR')$$,
  '22023',
  'participation type must be SUBCONTRACTOR or OTHER',
  'add_project_company refuses MAIN_CONTRACTOR participation'
);

-- t6: the subcontractor company can be suspended.
select public.update_project_company(
  (select id from public.project_companies where project_id = 'd0a11111-1111-4111-8111-111111111111' and tenant_id = 'd0222222-2222-4222-8222-222222222222'),
  null, 'SUSPENDED'
);
reset role;
select is(
  (select status from public.project_companies where project_id = 'd0a11111-1111-4111-8111-111111111111' and tenant_id = 'd0222222-2222-4222-8222-222222222222'),
  'SUSPENDED',
  'manager: subcontractor company is suspended'
);

-- t7: suspension is audited.
select is(
  (select count(*) from public.audit_log where action = 'project_company.suspended'),
  1::bigint,
  'suspension writes a project_company.suspended audit row'
);

-- t8: the MAIN_CONTRACTOR company cannot be suspended.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SITE_MANAGER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.update_project_company((select id from public.project_companies where project_id = 'd0a11111-1111-4111-8111-111111111111' and participation_type = 'MAIN_CONTRACTOR'), null, 'SUSPENDED')$$,
  '22023',
  'the main contractor cannot be suspended or ended',
  'main contractor company cannot be suspended'
);

-- t9: members cannot be added to a suspended company.
select throws_ok(
  $$select public.add_project_member('d0a11111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'd0a11111-1111-4111-8111-111111111111' and tenant_id = 'd0222222-2222-4222-8222-222222222222'), 'd4444444-4444-4444-8444-444444444444', 'WORKER')$$,
  '22023',
  'company is not active in this project',
  'add_project_member refused for a suspended company'
);

-- t10: reactivating the company restores ACTIVE status.
select public.update_project_company(
  (select id from public.project_companies where project_id = 'd0a11111-1111-4111-8111-111111111111' and tenant_id = 'd0222222-2222-4222-8222-222222222222'),
  null, 'ACTIVE'
);
reset role;
select is(
  (select status from public.project_companies where project_id = 'd0a11111-1111-4111-8111-111111111111' and tenant_id = 'd0222222-2222-4222-8222-222222222222'),
  'ACTIVE',
  'manager: subcontractor company is reactivated'
);

-- t11: a user of the company tenant can be added as a project member of that company.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SITE_MANAGER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
select public.add_project_member(
  'd0a11111-1111-4111-8111-111111111111',
  (select id from public.project_companies where project_id = 'd0a11111-1111-4111-8111-111111111111' and tenant_id = 'd0222222-2222-4222-8222-222222222222'),
  'd4444444-4444-4444-8444-444444444444',
  'WORKER'
);
reset role;
select is(
  (select count(*) from public.project_memberships where project_id = 'd0a11111-1111-4111-8111-111111111111' and user_id = 'd4444444-4444-4444-8444-444444444444'),
  1::bigint,
  'manager: company user is added as a project member'
);

-- t12: a user outside the company tenant cannot be added to that company.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SITE_MANAGER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.add_project_member('d0a11111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'd0a11111-1111-4111-8111-111111111111' and tenant_id = 'd0222222-2222-4222-8222-222222222222'), 'd2222222-2222-4222-8222-222222222222', 'WORKER')$$,
  '22023',
  'user is not a member of the company tenant',
  'add_project_member refuses a user from another tenant'
);

-- t13: removing a member deletes the project membership.
reset role;
create temp table t13_audit_baseline as
  select count(*) as n from public.audit_log where action = 'project_member.removed';
set local role authenticated;
select public.remove_project_member(
  (select id from public.project_memberships where project_id = 'd0a11111-1111-4111-8111-111111111111' and user_id = 'd4444444-4444-4444-8444-444444444444')
);
reset role;
select is(
  (select count(*) from public.project_memberships where project_id = 'd0a11111-1111-4111-8111-111111111111' and user_id = 'd4444444-4444-4444-8444-444444444444'),
  0::bigint,
  'manager: project membership is removed'
);

-- t14: removal is audited (relative to the baseline, so pre-existing audit rows do not matter).
select is(
  (select count(*) from public.audit_log where action = 'project_member.removed') - (select n from t13_audit_baseline),
  1::bigint,
  'remove_project_member writes a project_member.removed audit row'
);

-- t15: a soft-deleted project refuses company writes, even for its former manager.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SITE_MANAGER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.add_project_company('d0a22222-2222-4222-8222-222222222222', 'd0222222-2222-4222-8222-222222222222', 'OTHER')$$,
  '42501',
  'not allowed to manage this project',
  'soft-deleted project: add_project_company is refused'
);
reset role;

-- t16: anon has no EXECUTE on the write RPCs.
select ok(
  not has_function_privilege('anon', 'public.add_project_company(uuid,uuid,text)', 'EXECUTE'),
  'anon has no EXECUTE on add_project_company'
);

select * from finish();
rollback;
