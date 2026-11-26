begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id) values
  ('b1111111-1111-4111-8111-111111111111'),
  ('b2222222-2222-4222-8222-222222222222'),
  ('b3333333-3333-4333-8333-333333333333'),
  ('b4444444-4444-4444-8444-444444444444');

insert into public.tenants (id, name, code) values
  ('b0111111-1111-4111-8111-111111111111', 'SDV Tenant 1', 'SDV_TEST_T1'),
  ('b0222222-2222-4222-8222-222222222222', 'SDV Tenant 2', 'SDV_TEST_T2');

insert into public.memberships (user_id, tenant_id, role) values
  ('b1111111-1111-4111-8111-111111111111', 'b0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('b3333333-3333-4333-8333-333333333333', 'b0111111-1111-4111-8111-111111111111', 'SITE_MANAGER'),
  ('b4444444-4444-4444-8444-444444444444', 'b0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('b4444444-4444-4444-8444-444444444444', 'b0222222-2222-4222-8222-222222222222', 'WORKER');

insert into public.projects (id, tenant_id, site_name) values
  ('b0211111-1111-4111-8111-111111111111', 'b0111111-1111-4111-8111-111111111111', 'SDV Active Project'),
  ('b0212222-2222-4222-8222-222222222222', 'b0111111-1111-4111-8111-111111111111', 'SDV Deleted Project');

insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values
  ('b1111111-1111-4111-8111-111111111111', 'b0211111-1111-4111-8111-111111111111', 'b0111111-1111-4111-8111-111111111111', 'WORKER', 'PROJECT'),
  ('b3333333-3333-4333-8333-333333333333', 'b0211111-1111-4111-8111-111111111111', 'b0111111-1111-4111-8111-111111111111', 'SITE_MANAGER', 'PROJECT'),
  ('b1111111-1111-4111-8111-111111111111', 'b0212222-2222-4222-8222-222222222222', 'b0111111-1111-4111-8111-111111111111', 'WORKER', 'PROJECT'),
  ('b3333333-3333-4333-8333-333333333333', 'b0212222-2222-4222-8222-222222222222', 'b0111111-1111-4111-8111-111111111111', 'SITE_MANAGER', 'PROJECT');

update public.projects set deleted_at = now()
where id = 'b0212222-2222-4222-8222-222222222222';

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"WORKER","tenant_id":"b0111111-1111-4111-8111-111111111111"}', true);

select is(
  (select count(*) from public.projects where id = 'b0211111-1111-4111-8111-111111111111'),
  1::bigint,
  'member + active project: project is visible'
);

select is(
  (select count(*) from public.projects where id = 'b0212222-2222-4222-8222-222222222222'),
  0::bigint,
  'member + deleted project: project is hidden by the SELECT policy'
);

select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated","app_role":"WORKER","tenant_id":"b0111111-1111-4111-8111-111111111111"}', true);

select is(
  (select count(*) from public.projects where id = 'b0211111-1111-4111-8111-111111111111'),
  0::bigint,
  'non-member of the tenant + active project: project is hidden (tenant isolation)'
);

select set_config('request.jwt.claims', '{"sub":"b3333333-3333-4333-8333-333333333333","role":"authenticated","app_role":"SITE_MANAGER","tenant_id":"b0111111-1111-4111-8111-111111111111"}', true);

select ok(
  not public.is_main_contractor_manager('b0212222-2222-4222-8222-222222222222'),
  'main contractor manager + deleted project: is_main_contractor_manager is FALSE'
);

select ok(
  public.is_main_contractor_manager('b0211111-1111-4111-8111-111111111111'),
  'main contractor manager + active project: is_main_contractor_manager is TRUE'
);

select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"WORKER","tenant_id":"b0222222-2222-4222-8222-222222222222"}', true);

select is(
  public.current_tenant_id(),
  null::uuid,
  'claimed tenant the user does not belong to: current_tenant_id is NULL (deny)'
);

select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SYS_ADMIN","tenant_id":"b0111111-1111-4111-8111-111111111111"}', true);

select is(
  public.current_app_role(),
  'WORKER',
  'forged app_role claim is ignored: current_app_role comes from memberships'
);

select set_config('request.jwt.claims', '{"sub":"b4444444-4444-4444-8444-444444444444","role":"authenticated","app_role":"WORKER","tenant_id":"b0222222-2222-4222-8222-222222222222"}', true);

select is(
  public.current_tenant_id(),
  'b0222222-2222-4222-8222-222222222222'::uuid,
  'user with two tenants: the claimed tenant is honoured only because memberships confirms it'
);

select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"WORKER","tenant_id":"b0111111-1111-4111-8111-111111111111"}', true);

select ok(
  public.can_run_project_company_business_write(
    (select id from public.project_companies where project_id = 'b0211111-1111-4111-8111-111111111111' and participation_type = 'MAIN_CONTRACTOR')
  ),
  'project company ACTIVE + member: business write is allowed'
);

reset role;
update public.project_companies set status = 'SUSPENDED'
where project_id = 'b0211111-1111-4111-8111-111111111111' and participation_type = 'MAIN_CONTRACTOR';
set local role authenticated;

select ok(
  not public.can_run_project_company_business_write(
    (select id from public.project_companies where project_id = 'b0211111-1111-4111-8111-111111111111' and participation_type = 'MAIN_CONTRACTOR')
  ),
  'project company SUSPENDED: new business write is denied'
);

reset role;
update public.project_companies set status = 'ENDED'
where project_id = 'b0211111-1111-4111-8111-111111111111' and participation_type = 'MAIN_CONTRACTOR';
set local role authenticated;

select ok(
  not public.can_run_project_company_business_write(
    (select id from public.project_companies where project_id = 'b0211111-1111-4111-8111-111111111111' and participation_type = 'MAIN_CONTRACTOR')
  ),
  'project company ENDED: new business write is denied'
);

select lives_ok(
  $$select public.write_audit('project_company.ended', 'project_company', 'x', null, 'b0211111-1111-4111-8111-111111111111',
      (select id from public.project_companies where project_id = 'b0211111-1111-4111-8111-111111111111' and participation_type = 'MAIN_CONTRACTOR'),
      '{"reason":"ended"}', 'sdv-ended-1')$$,
  'project company ENDED: administrative audit is still written'
);

reset role;
select is(
  (select count(*) from public.audit_log where request_id = 'sdv-ended-1'),
  1::bigint,
  'ENDED company: exactly one audit row is recorded for the administrative event'
);

reset role;
insert into auth.users (id) values ('b5555555-5555-4555-8555-555555555555');
insert into public.memberships (user_id, tenant_id, role) values
  ('b5555555-5555-4555-8555-555555555555', 'b0111111-1111-4111-8111-111111111111', 'WORKER');
delete from public.memberships where user_id = 'b5555555-5555-4555-8555-555555555555';

select set_config('request.jwt.claims', '{"sub":"b5555555-5555-4555-8555-555555555555","role":"authenticated","app_role":"WORKER","tenant_id":"b0111111-1111-4111-8111-111111111111"}', true);
set local role authenticated;

select is(
  public.current_tenant_id(),
  null::uuid,
  'revoked tenant membership with a stale JWT tenant claim: current_tenant_id is NULL'
);

select * from finish();
rollback;
