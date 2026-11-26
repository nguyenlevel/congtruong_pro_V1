begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id) values
  ('e2500000-0000-4000-8000-000000000001'),
  ('e2500000-0000-4000-8000-000000000002'),
  ('e2500000-0000-4000-8000-000000000003'),
  ('e2500000-0000-4000-8000-000000000004'),
  ('e2500000-0000-4000-8000-000000000005');
update auth.users set email = 'invitee@example.test' where id = 'e2500000-0000-4000-8000-000000000005';

insert into public.tenants (id, name, code) values
  ('e2500001-0000-4000-8000-000000000001', 'P25 Main', 'P25_MAIN'),
  ('e2500002-0000-4000-8000-000000000002', 'P25 Sub', 'P25_SUB'),
  ('e2500003-0000-4000-8000-000000000003', 'P25 Other', 'P25_OTHER');

insert into public.organizations (id, tenant_id, name, code) values
  ('e2500a01-0000-4000-8000-000000000001', 'e2500003-0000-4000-8000-000000000003', 'Foreign org', 'FOR');

insert into public.memberships (user_id, tenant_id, role) values
  ('e2500000-0000-4000-8000-000000000001', 'e2500001-0000-4000-8000-000000000001', 'PROJECT_MANAGER'),
  ('e2500000-0000-4000-8000-000000000002', 'e2500001-0000-4000-8000-000000000001', 'WORKER'),
  ('e2500000-0000-4000-8000-000000000003', 'e2500001-0000-4000-8000-000000000001', 'SYS_ADMIN'),
  ('e2500000-0000-4000-8000-000000000004', 'e2500002-0000-4000-8000-000000000002', 'PROJECT_MANAGER');

-- PROJECT_MANAGER creates a project.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2500000-0000-4000-8000-000000000001","role":"authenticated","tenant_id":"e2500001-0000-4000-8000-000000000001"}', true);

create temp table created_project (id uuid);
grant all on created_project to authenticated;
insert into created_project select public.create_project('  P25 Site A  ', 'Hanoi');

select is(
  (select site_name from public.projects where id = (select id from created_project)),
  'P25 Site A',
  'PM creates a project (name trimmed) in own tenant'
);
select is(
  (select participation_type from public.project_companies where project_id = (select id from created_project)),
  'MAIN_CONTRACTOR',
  'creating tenant becomes MAIN_CONTRACTOR'
);
select is(
  (select role from public.project_memberships where project_id = (select id from created_project) and user_id = 'e2500000-0000-4000-8000-000000000001'),
  'PROJECT_MANAGER',
  'creator is a project member with PROJECT_MANAGER role'
);
select ok(
  public.can_manage_project_members((select id from created_project)),
  'creator can manage project members'
);
reset role;
select is(
  (select count(*)::int from public.audit_log where action = 'project.created' and project_id = (select id from created_project)),
  1,
  'project.created is audited'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2500000-0000-4000-8000-000000000001","role":"authenticated","tenant_id":"e2500001-0000-4000-8000-000000000001"}', true);
select throws_ok(
  $$select public.create_project('   ', '')$$,
  '22023', 'site name must be 1 to 200 characters', 'blank name is rejected'
);
select throws_ok(
  $$select public.create_project('X', '', 'e2500a01-0000-4000-8000-000000000001')$$,
  '22023', 'organization does not belong to the tenant', 'organization of another tenant is rejected'
);

-- prepare_project_invite: own company, allowed roles only.
select is(
  public.prepare_project_invite(
    (select id from created_project),
    (select id from public.project_companies where project_id = (select id from created_project)),
    'WORKER'
  ),
  'e2500001-0000-4000-8000-000000000001'::uuid,
  'prepare_project_invite returns the caller tenant for the main company'
);
select throws_ok(
  format($$select public.prepare_project_invite(%L, %L, 'SYS_ADMIN')$$,
    (select id from created_project),
    (select id from public.project_companies where project_id = (select id from created_project))),
  '42501', 'project manager cannot assign or change this role', 'invite cannot assign SYS_ADMIN'
);

-- add a SUB company to test cross-company invite (as postgres), then retry as PM.
reset role;
insert into public.project_companies (project_id, tenant_id, participation_type)
values ((select id from created_project), 'e2500002-0000-4000-8000-000000000002', 'SUBCONTRACTOR');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2500000-0000-4000-8000-000000000001","role":"authenticated","tenant_id":"e2500001-0000-4000-8000-000000000001"}', true);

select throws_ok(
  format($$select public.prepare_project_invite(%L, %L, 'WORKER')$$,
    (select id from created_project),
    (select id from public.project_companies where project_id = (select id from created_project) and tenant_id = 'e2500002-0000-4000-8000-000000000002')),
  '42501', 'invites can only target the caller''s own company', 'invite into another company tenant is rejected'
);

-- WORKER cannot create projects.
select set_config('request.jwt.claims', '{"sub":"e2500000-0000-4000-8000-000000000002","role":"authenticated","tenant_id":"e2500001-0000-4000-8000-000000000001"}', true);
select throws_ok(
  $$select public.create_project('Nope', '')$$,
  '42501', 'not allowed to create projects', 'WORKER cannot create projects'
);
select ok(
  not public.can_manage_project_members((select id from created_project)),
  'WORKER cannot manage project members'
);

-- SYS_ADMIN creates and manages as PROJECT_MANAGER.
select set_config('request.jwt.claims', '{"sub":"e2500000-0000-4000-8000-000000000003","role":"authenticated","tenant_id":"e2500001-0000-4000-8000-000000000001"}', true);
create temp table admin_project (id uuid);
grant all on admin_project to authenticated;
insert into admin_project select public.create_project('P25 Admin Site');
select is(
  (select role from public.project_memberships where project_id = (select id from admin_project)),
  'PROJECT_MANAGER',
  'SYS_ADMIN creator is stored as PROJECT_MANAGER (no role above the tenant role)'
);

-- Service-only helpers.
select ok(
  not has_function_privilege('authenticated', 'public.service_grant_tenant_membership(uuid,uuid,text)', 'EXECUTE'),
  'authenticated cannot execute service_grant_tenant_membership'
);
select ok(
  not has_function_privilege('authenticated', 'public.find_user_id_by_email(text)', 'EXECUTE'),
  'authenticated cannot execute find_user_id_by_email'
);
select ok(
  not has_function_privilege('anon', 'public.create_project(text,text,uuid)', 'EXECUTE'),
  'anon cannot execute create_project'
);

reset role;
set local role service_role;
select is(
  public.find_user_id_by_email('INVITEE@example.test'),
  'e2500000-0000-4000-8000-000000000005'::uuid,
  'service_role finds a user by email (case-insensitive)'
);
select public.service_grant_tenant_membership('e2500001-0000-4000-8000-000000000001', 'e2500000-0000-4000-8000-000000000005', 'WORKER');
reset role;
select is(
  (select role from public.memberships where user_id = 'e2500000-0000-4000-8000-000000000005' and tenant_id = 'e2500001-0000-4000-8000-000000000001'),
  'WORKER',
  'service_role grants tenant membership'
);
set local role service_role;
select throws_ok(
  $$select public.service_grant_tenant_membership('e2500001-0000-4000-8000-000000000001', 'e2500000-0000-4000-8000-000000000005', 'SYS_ADMIN')$$,
  '22023', 'invite supports WORKER and PROJECT_VIEWER only', 'service grant refuses privileged roles'
);

select * from finish();
rollback;
