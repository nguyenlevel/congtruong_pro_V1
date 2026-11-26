begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id) values
  ('f7111111-1111-4111-8111-111111111111'),
  ('f7222222-2222-4222-8222-222222222222'),
  ('f7333333-3333-4333-8333-333333333333'),
  ('f7444444-4444-4444-8444-444444444444'),
  ('f7555555-5555-4555-8555-555555555555');

insert into public.tenants (id, name, code) values
  ('f0c11111-1111-4111-8111-111111111111', 'PMM Main', 'PMM2_MAIN'),
  ('f0c22222-2222-4222-8222-222222222222', 'PMM Sub', 'PMM2_SUB');

insert into public.memberships (user_id, tenant_id, role) values
  ('f7111111-1111-4111-8111-111111111111', 'f0c11111-1111-4111-8111-111111111111', 'PROJECT_MANAGER'),
  ('f7222222-2222-4222-8222-222222222222', 'f0c11111-1111-4111-8111-111111111111', 'SITE_MANAGER'),
  ('f7333333-3333-4333-8333-333333333333', 'f0c22222-2222-4222-8222-222222222222', 'PROJECT_MANAGER'),
  ('f7444444-4444-4444-8444-444444444444', 'f0c22222-2222-4222-8222-222222222222', 'WORKER'),
  ('f7555555-5555-4555-8555-555555555555', 'f0c22222-2222-4222-8222-222222222222', 'WORKER');

insert into public.projects (id, tenant_id, site_name) values
  ('f0c31111-1111-4111-8111-111111111111', 'f0c11111-1111-4111-8111-111111111111', 'PMM Site A'),
  ('f0c32222-2222-4222-8222-222222222222', 'f0c11111-1111-4111-8111-111111111111', 'PMM Site B');

insert into public.project_companies (project_id, tenant_id, participation_type, status) values
  ('f0c31111-1111-4111-8111-111111111111', 'f0c22222-2222-4222-8222-222222222222', 'SUBCONTRACTOR', 'ACTIVE');

insert into public.project_memberships (id, user_id, project_id, tenant_id, role, scope) values
  ('f0cd0001-0001-4001-8001-000000000001', 'f7111111-1111-4111-8111-111111111111', 'f0c31111-1111-4111-8111-111111111111', 'f0c11111-1111-4111-8111-111111111111', 'PROJECT_MANAGER', 'PROJECT'),
  ('f0cd0002-0002-4002-8002-000000000002', 'f7222222-2222-4222-8222-222222222222', 'f0c31111-1111-4111-8111-111111111111', 'f0c11111-1111-4111-8111-111111111111', 'SITE_MANAGER', 'PROJECT'),
  ('f0cd0003-0003-4003-8003-000000000003', 'f7333333-3333-4333-8333-333333333333', 'f0c31111-1111-4111-8111-111111111111', 'f0c22222-2222-4222-8222-222222222222', 'PROJECT_MANAGER', 'PROJECT_COMPANY'),
  ('f0cd0004-0004-4004-8004-000000000004', 'f7444444-4444-4444-8444-444444444444', 'f0c31111-1111-4111-8111-111111111111', 'f0c22222-2222-4222-8222-222222222222', 'WORKER', 'PROJECT_COMPANY'),
  ('f0cd0005-0005-4005-8005-000000000005', 'f7555555-5555-4555-8555-555555555555', 'f0c31111-1111-4111-8111-111111111111', 'f0c22222-2222-4222-8222-222222222222', 'PROJECT_MANAGER', 'PROJECT_COMPANY');

-- Sub-company PM (f7333333) is a PROJECT_MANAGER of a SUBCONTRACTOR tenant, not of the MAIN_CONTRACTOR.
-- Main PM (f7111111) is a PROJECT_MANAGER of the MAIN_CONTRACTOR tenant assigned only to P1 (c31111).

-- t1: a MAIN_CONTRACTOR PROJECT_MANAGER adds a PROJECT_VIEWER member in its project.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f7111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select isnt(
  public.add_project_member('f0c31111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'f0c31111-1111-4111-8111-111111111111' and tenant_id = 'f0c22222-2222-4222-8222-222222222222'), 'f7555555-5555-4555-8555-555555555555', 'PROJECT_VIEWER'),
  null::uuid,
  'main project manager: adds a PROJECT_VIEWER member in its project'
);
reset role;

-- t2: a MAIN_CONTRACTOR PROJECT_MANAGER cannot grant SITE_MANAGER.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f7111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$select public.add_project_member('f0c31111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'f0c31111-1111-4111-8111-111111111111' and tenant_id = 'f0c22222-2222-4222-8222-222222222222'), 'f7555555-5555-4555-8555-555555555555', 'SITE_MANAGER')$$,
  '42501',
  'project manager cannot assign or change this role',
  'main project manager: cannot grant SITE_MANAGER'
);

-- t3: a MAIN_CONTRACTOR PROJECT_MANAGER cannot grant PROJECT_MANAGER (no self-escalation).
select throws_ok(
  $$select public.add_project_member('f0c31111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'f0c31111-1111-4111-8111-111111111111' and tenant_id = 'f0c22222-2222-4222-8222-222222222222'), 'f7444444-4444-4444-8444-444444444444', 'PROJECT_MANAGER')$$,
  '42501',
  'project manager cannot assign or change this role',
  'main project manager: cannot grant PROJECT_MANAGER'
);

-- t4: a PROJECT_MANAGER may change a WORKER membership to PROJECT_VIEWER.
select lives_ok(
  $$select public.update_project_member_role('f0cd0004-0004-4004-8004-000000000004', 'PROJECT_VIEWER')$$,
  'main project manager: updates a WORKER membership to PROJECT_VIEWER'
);

-- t5: a PROJECT_MANAGER cannot change a PROJECT_MANAGER membership.
select throws_ok(
  $$select public.update_project_member_role('f0cd0005-0005-4005-8005-000000000005', 'WORKER')$$,
  '42501',
  'project manager cannot assign or change this role',
  'main project manager: cannot change a PROJECT_MANAGER membership'
);

-- t6: a PROJECT_MANAGER cannot promote a membership to SITE_MANAGER.
select throws_ok(
  $$select public.update_project_member_role('f0cd0004-0004-4004-8004-000000000004', 'SITE_MANAGER')$$,
  '42501',
  'project manager cannot assign or change this role',
  'main project manager: cannot promote a membership to SITE_MANAGER'
);

-- t7: a PROJECT_MANAGER cannot remove a SITE_MANAGER membership.
select throws_ok(
  $$select public.remove_project_member('f0cd0002-0002-4002-8002-000000000002')$$,
  '42501',
  'project manager cannot assign or change this role',
  'main project manager: cannot remove a SITE_MANAGER membership'
);

-- t8: a PROJECT_MANAGER removes a non-privileged membership in its project.
select lives_ok(
  $$select public.remove_project_member((select id from public.project_memberships where user_id = 'f7555555-5555-4555-8555-555555555555' and project_id = 'f0c31111-1111-4111-8111-111111111111' and role = 'PROJECT_VIEWER'))$$,
  'main project manager: removes a PROJECT_VIEWER membership in its project'
);

-- t9: a PROJECT_MANAGER of a different project (not assigned) is refused.
select throws_ok(
  $$select public.add_project_member('f0c32222-2222-4222-8222-222222222222', (select id from public.project_companies where project_id = 'f0c32222-2222-4222-8222-222222222222' and tenant_id = 'f0c11111-1111-4111-8111-111111111111'), 'f7444444-4444-4444-8444-444444444444', 'WORKER')$$,
  '42501',
  'not allowed to manage project members',
  'main project manager: refused for a project it is not assigned to'
);
reset role;

-- t10: a SUBCONTRACTOR PROJECT_MANAGER cannot manage members of another company or project.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f7333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$select public.add_project_member('f0c31111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'f0c31111-1111-4111-8111-111111111111' and tenant_id = 'f0c22222-2222-4222-8222-222222222222'), 'f7555555-5555-4555-8555-555555555555', 'WORKER')$$,
  '42501',
  'not allowed to manage project members',
  'subcontractor project manager: cannot add members'
);
reset role;

-- t11: legacy SITE_MANAGER keeps member management and may grant PROJECT_MANAGER.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f7222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select isnt(
  public.add_project_member('f0c31111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'f0c31111-1111-4111-8111-111111111111' and tenant_id = 'f0c22222-2222-4222-8222-222222222222'), 'f7444444-4444-4444-8444-444444444444', 'PROJECT_MANAGER'),
  null::uuid,
  'legacy site manager: still grants PROJECT_MANAGER membership'
);

-- t12: legacy SITE_MANAGER keeps the pre-020 ability to remove any project membership.
select lives_ok(
  $$select public.remove_project_member('f0cd0005-0005-4005-8005-000000000005')$$,
  'legacy site manager: removes a PROJECT_MANAGER membership (unchanged legacy behaviour)'
);
reset role;

select * from finish();

rollback;
