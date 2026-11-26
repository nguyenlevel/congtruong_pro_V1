begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id) values
  ('f1111111-1111-4111-8111-111111111111'),
  ('f2222222-2222-4222-8222-222222222222'),
  ('f3333333-3333-4333-8333-333333333333'),
  ('f4444444-4444-4444-8444-444444444444'),
  ('f5555555-5555-4555-8555-555555555555'),
  ('f6666666-6666-4666-8666-666666666666');

insert into public.tenants (id, name, code) values
  ('f0111111-1111-4111-8111-111111111111', 'PM Main', 'PM_TEST_MAIN'),
  ('f0222222-2222-4222-8222-222222222222', 'PM Sub', 'PM_TEST_SUB'),
  ('f0333333-3333-4333-8333-333333333333', 'PM Other Sub', 'PM_TEST_SUB2');

insert into public.memberships (user_id, tenant_id, role) values
  ('f1111111-1111-4111-8111-111111111111', 'f0111111-1111-4111-8111-111111111111', 'PROJECT_MANAGER'),
  ('f2222222-2222-4222-8222-222222222222', 'f0111111-1111-4111-8111-111111111111', 'SITE_MANAGER'),
  ('f3333333-3333-4333-8333-333333333333', 'f0222222-2222-4222-8222-222222222222', 'PROJECT_MANAGER'),
  ('f4444444-4444-4444-8444-444444444444', 'f0111111-1111-4111-8111-111111111111', 'PROJECT_MANAGER'),
  ('f5555555-5555-4555-8555-555555555555', 'f0111111-1111-4111-8111-111111111111', 'PROJECT_MANAGER'),
  ('f6666666-6666-4666-8666-666666666666', 'f0222222-2222-4222-8222-222222222222', 'WORKER');

insert into public.projects (id, tenant_id, site_name) values
  ('f0a11111-1111-4111-8111-111111111111', 'f0111111-1111-4111-8111-111111111111', 'PM Site A'),
  ('f0a22222-2222-4222-8222-222222222222', 'f0111111-1111-4111-8111-111111111111', 'PM Site B'),
  ('f0a33333-3333-4333-8333-333333333333', 'f0111111-1111-4111-8111-111111111111', 'PM Deleted Site');

insert into public.project_companies (project_id, tenant_id, participation_type, status) values
  ('f0a11111-1111-4111-8111-111111111111', 'f0222222-2222-4222-8222-222222222222', 'SUBCONTRACTOR', 'ACTIVE');

insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values
  ('f1111111-1111-4111-8111-111111111111', 'f0a11111-1111-4111-8111-111111111111', 'f0111111-1111-4111-8111-111111111111', 'PROJECT_MANAGER', 'PROJECT'),
  ('f2222222-2222-4222-8222-222222222222', 'f0a11111-1111-4111-8111-111111111111', 'f0111111-1111-4111-8111-111111111111', 'SITE_MANAGER', 'PROJECT'),
  ('f3333333-3333-4333-8333-333333333333', 'f0a11111-1111-4111-8111-111111111111', 'f0222222-2222-4222-8222-222222222222', 'PROJECT_MANAGER', 'PROJECT_COMPANY'),
  ('f4444444-4444-4444-8444-444444444444', 'f0a22222-2222-4222-8222-222222222222', 'f0111111-1111-4111-8111-111111111111', 'PROJECT_MANAGER', 'PROJECT'),
  ('f5555555-5555-4555-8555-555555555555', 'f0a11111-1111-4111-8111-111111111111', 'f0111111-1111-4111-8111-111111111111', 'PROJECT_MANAGER', 'PROJECT'),
  ('f1111111-1111-4111-8111-111111111111', 'f0a33333-3333-4333-8333-333333333333', 'f0111111-1111-4111-8111-111111111111', 'PROJECT_MANAGER', 'PROJECT');

insert into public.tenants (id, name, code) values
  ('f0444444-4444-4444-8444-444444444444', 'PM New Sub', 'PM_TEST_NEW');

update public.projects set deleted_at = now() where id = 'f0a33333-3333-4333-8333-333333333333';
delete from public.project_memberships where user_id = 'f5555555-5555-4555-8555-555555555555';

-- t1: the PROJECT_MANAGER role exists with its permissions.
select ok(
  exists (select 1 from public.roles where name = 'PROJECT_MANAGER')
    and exists (select 1 from public.role_permissions where role_name = 'PROJECT_MANAGER' and permission_key = 'project.write'),
  'PROJECT_MANAGER role and project.write permission exist'
);

-- t2: a PROJECT_MANAGER of the MAIN_CONTRACTOR adds a company.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select isnt(
  public.add_project_company('f0a11111-1111-4111-8111-111111111111', 'f0444444-4444-4444-8444-444444444444', 'OTHER'),
  null::uuid,
  'project manager: add_project_company succeeds'
);

-- t3: a PROJECT_MANAGER suspends a subcontractor company.
select public.update_project_company(
  (select id from public.project_companies where project_id = 'f0a11111-1111-4111-8111-111111111111' and tenant_id = 'f0444444-4444-4444-8444-444444444444'),
  null, 'SUSPENDED'
);
reset role;
select is(
  (select status from public.project_companies where project_id = 'f0a11111-1111-4111-8111-111111111111' and tenant_id = 'f0444444-4444-4444-8444-444444444444'),
  'SUSPENDED',
  'project manager: company added in this project is suspended'
);

-- t4: a PROJECT_MANAGER of the MAIN_CONTRACTOR adds a member in its project (ADR-001 Q-PM-2).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select isnt(
  public.add_project_member('f0a11111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'f0a11111-1111-4111-8111-111111111111' and tenant_id = 'f0222222-2222-4222-8222-222222222222'), 'f6666666-6666-4666-8666-666666666666', 'WORKER'),
  null::uuid,
  'project manager (main): add_project_member succeeds in its project (Q-PM-2)'
);
reset role;

-- t5: SITE_MANAGER keeps the member management it had before this migration.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select isnt(
  public.add_project_member('f0a11111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'f0a11111-1111-4111-8111-111111111111' and tenant_id = 'f0222222-2222-4222-8222-222222222222'),   'f6666666-6666-4666-8666-666666666666', 'PROJECT_VIEWER'),
  null::uuid,
  'site manager (legacy): add_project_member still succeeds'
);
reset role;

-- t6: SITE_MANAGER still manages companies (regression).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select public.update_project_company(
  (select id from public.project_companies where project_id = 'f0a11111-1111-4111-8111-111111111111' and tenant_id = 'f0444444-4444-4444-8444-444444444444'),
  null, 'ACTIVE'
);
reset role;
select is(
  (select status from public.project_companies where project_id = 'f0a11111-1111-4111-8111-111111111111' and tenant_id = 'f0444444-4444-4444-8444-444444444444'),
  'ACTIVE',
  'site manager (legacy): still reactivates a company'
);

-- t7: a PROJECT_MANAGER of a SUBCONTRACTOR cannot manage companies of the project.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$select public.add_project_company('f0a11111-1111-4111-8111-111111111111', 'f0333333-3333-4333-8333-333333333333', 'OTHER')$$,
  '42501',
  'not allowed to manage this project',
  'subcontractor project manager: add_project_company is refused'
);
reset role;

-- t8: a PROJECT_MANAGER of project B cannot manage project A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f4444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
select throws_ok(
  $$select public.add_project_company('f0a11111-1111-4111-8111-111111111111', 'f0333333-3333-4333-8333-333333333333', 'OTHER')$$,
  '42501',
  'not allowed to manage this project',
  'project manager of another project is refused'
);
reset role;

-- t9: a PROJECT_MANAGER cannot manage a soft-deleted project.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$select public.add_project_company('f0a33333-3333-4333-8333-333333333333', 'f0333333-3333-4333-8333-333333333333', 'OTHER')$$,
  '42501',
  'not allowed to manage this project',
  'soft-deleted project: project manager is refused'
);
reset role;

-- t10: a revoked PROJECT_MANAGER is refused.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
select throws_ok(
  $$select public.add_project_company('f0a11111-1111-4111-8111-111111111111', 'f0333333-3333-4333-8333-333333333333', 'OTHER')$$,
  '42501',
  'not allowed to manage this project',
  'revoked project manager is refused'
);
reset role;

-- t11: a role outside the approved matrix (COMPANY_ADMIN) cannot be assigned, so it gains no rights.
select throws_ok(
  $$insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values ('f6666666-6666-4666-8666-666666666666', 'f0a11111-1111-4111-8111-111111111111', 'f0222222-2222-4222-8222-222222222222', 'COMPANY_ADMIN', 'PROJECT_COMPANY')$$,
  '23503',
  null,
  'COMPANY_ADMIN is not a role in the database and cannot be assigned'
);

select * from finish();
rollback;
