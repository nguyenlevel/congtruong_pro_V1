begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id) values
  ('f0d10000-0000-4000-8000-000000000001'),
  ('f0d20000-0000-4000-8000-000000000002'),
  ('f0d30000-0000-4000-8000-000000000003'),
  ('f0d40000-0000-4000-8000-000000000004'),
  ('f0d50000-0000-4000-8000-000000000005'),
  ('f0d60000-0000-4000-8000-000000000006');

insert into public.tenants (id, name, code) values
  ('f0d00001-0000-4000-8000-000000000001', 'P21 Main', 'P21_MAIN'),
  ('f0d00002-0000-4000-8000-000000000002', 'P21 Sub', 'P21_SUB'),
  ('f0d00003-0000-4000-8000-000000000003', 'P21 Other', 'P21_OTHER');

insert into public.memberships (user_id, tenant_id, role) values
  ('f0d10000-0000-4000-8000-000000000001', 'f0d00001-0000-4000-8000-000000000001', 'PROJECT_MANAGER'),
  ('f0d20000-0000-4000-8000-000000000002', 'f0d00002-0000-4000-8000-000000000002', 'WORKER'),
  ('f0d30000-0000-4000-8000-000000000003', 'f0d00003-0000-4000-8000-000000000003', 'WORKER'),
  ('f0d50000-0000-4000-8000-000000000005', 'f0d00002-0000-4000-8000-000000000002', 'WORKER'),
  ('f0d60000-0000-4000-8000-000000000006', 'f0d00002-0000-4000-8000-000000000002', 'WORKER');

-- P1 active sub, P2 suspended sub, P3 ended sub, P4 soft-deleted with active sub, P5 no sub.
insert into public.projects (id, tenant_id, site_name, deleted_at) values
  ('f0d11111-0000-4000-8000-000000000001', 'f0d00001-0000-4000-8000-000000000001', 'P21 P1', null),
  ('f0d12222-0000-4000-8000-000000000002', 'f0d00001-0000-4000-8000-000000000001', 'P21 P2', null),
  ('f0d13333-0000-4000-8000-000000000003', 'f0d00001-0000-4000-8000-000000000001', 'P21 P3', null),
  ('f0d14444-0000-4000-8000-000000000004', 'f0d00001-0000-4000-8000-000000000001', 'P21 P4', now()),
  ('f0d15555-0000-4000-8000-000000000005', 'f0d00001-0000-4000-8000-000000000001', 'P21 P5', null);

insert into public.project_companies (project_id, tenant_id, participation_type, status) values
  ('f0d11111-0000-4000-8000-000000000001', 'f0d00002-0000-4000-8000-000000000002', 'SUBCONTRACTOR', 'ACTIVE'),
  ('f0d12222-0000-4000-8000-000000000002', 'f0d00002-0000-4000-8000-000000000002', 'SUBCONTRACTOR', 'SUSPENDED'),
  ('f0d13333-0000-4000-8000-000000000003', 'f0d00002-0000-4000-8000-000000000002', 'SUBCONTRACTOR', 'ENDED'),
  ('f0d14444-0000-4000-8000-000000000004', 'f0d00002-0000-4000-8000-000000000002', 'SUBCONTRACTOR', 'ACTIVE');

insert into public.project_memberships (id, user_id, project_id, tenant_id, role, scope) values
  ('f0dd0001-0000-4000-8000-000000000001', 'f0d10000-0000-4000-8000-000000000001', 'f0d11111-0000-4000-8000-000000000001', 'f0d00001-0000-4000-8000-000000000001', 'PROJECT_MANAGER', 'PROJECT'),
  ('f0dd0002-0000-4000-8000-000000000002', 'f0d60000-0000-4000-8000-000000000006', 'f0d11111-0000-4000-8000-000000000001', 'f0d00002-0000-4000-8000-000000000002', 'WORKER', 'PROJECT_COMPANY');

-- Sub-tenant user sees the participating project (ACTIVE), then the historical ones.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0d20000-0000-4000-8000-000000000002","role":"authenticated","tenant_id":"f0d00002-0000-4000-8000-000000000002"}', true);

select is(
  (select count(*)::int from public.projects where id = 'f0d11111-0000-4000-8000-000000000001'),
  1,
  'participant: ACTIVE subcontractor sees the project'
);
select is(
  (select count(*)::int from public.projects where id = 'f0d12222-0000-4000-8000-000000000002'),
  1,
  'participant: SUSPENDED subcontractor sees historical project'
);
select is(
  (select count(*)::int from public.projects where id = 'f0d13333-0000-4000-8000-000000000003'),
  1,
  'participant: ENDED subcontractor sees historical project'
);
select is(
  (select count(*)::int from public.projects where id = 'f0d14444-0000-4000-8000-000000000004'),
  0,
  'participant: soft-deleted project is hidden'
);
select is(
  (select count(*)::int from public.projects where id = 'f0d15555-0000-4000-8000-000000000005'),
  0,
  'non-participant company does not see a project it does not join'
);
reset role;

-- A user of a non-participating tenant sees nothing from the project.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0d30000-0000-4000-8000-000000000003","role":"authenticated","tenant_id":"f0d00003-0000-4000-8000-000000000003"}', true);
select is(
  (select count(*)::int from public.projects where id = 'f0d11111-0000-4000-8000-000000000001'),
  0,
  'other tenant: company not in project cannot see it'
);
reset role;

-- Revoked membership: the claimed tenant no longer confirms, so the subcontractor user is denied.
delete from public.memberships
 where user_id = 'f0d50000-0000-4000-8000-000000000005'
   and tenant_id = 'f0d00002-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0d50000-0000-4000-8000-000000000005","role":"authenticated","tenant_id":"f0d00002-0000-4000-8000-000000000002"}', true);
select is(
  (select count(*)::int from public.projects where id = 'f0d11111-0000-4000-8000-000000000001'),
  0,
  'revoked tenant membership: project is no longer visible'
);
reset role;

-- DB-SEC-01: PROJECT_MANAGER of the MAIN_CONTRACTOR may assign only WORKER and PROJECT_VIEWER.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0d10000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.add_project_member('f0d11111-0000-4000-8000-000000000001', (select id from public.project_companies where project_id = 'f0d11111-0000-4000-8000-000000000001' and tenant_id = 'f0d00002-0000-4000-8000-000000000002'), 'f0d20000-0000-4000-8000-000000000002', 'SUB_CONTRACTOR')$$,
  '42501',
  'project manager cannot assign or change this role',
  'escalation: PROJECT_MANAGER cannot assign SUB_CONTRACTOR'
);
select throws_ok(
  $$select public.add_project_member('f0d11111-0000-4000-8000-000000000001', (select id from public.project_companies where project_id = 'f0d11111-0000-4000-8000-000000000001' and tenant_id = 'f0d00002-0000-4000-8000-000000000002'), 'f0d20000-0000-4000-8000-000000000002', 'SYS_ADMIN')$$,
  '42501',
  'project manager cannot assign or change this role',
  'escalation: PROJECT_MANAGER cannot assign SYS_ADMIN'
);
select isnt(
  public.add_project_member('f0d11111-0000-4000-8000-000000000001', (select id from public.project_companies where project_id = 'f0d11111-0000-4000-8000-000000000001' and tenant_id = 'f0d00002-0000-4000-8000-000000000002'), 'f0d20000-0000-4000-8000-000000000002', 'WORKER'),
  null::uuid,
  'valid: PROJECT_MANAGER assigns WORKER'
);
select throws_ok(
  $$select public.update_project_member_role('f0dd0002-0000-4000-8000-000000000002', 'SUB_CONTRACTOR')$$,
  '42501',
  'project manager cannot assign or change this role',
  'escalation: PROJECT_MANAGER cannot promote a WORKER membership to SUB_CONTRACTOR'
);
reset role;

select * from finish();

rollback;
