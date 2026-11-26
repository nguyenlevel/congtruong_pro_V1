begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id) values
  ('f0e10000-0000-4000-8000-000000000001'),
  ('f0e20000-0000-4000-8000-000000000002'),
  ('f0e30000-0000-4000-8000-000000000003'),
  ('f0e50000-0000-4000-8000-000000000005');

insert into public.tenants (id, name, code) values
  ('f0e00001-0000-4000-8000-000000000001', 'Child Main', 'CHILD_MAIN'),
  ('f0e00002-0000-4000-8000-000000000002', 'Child Sub', 'CHILD_SUB'),
  ('f0e00003-0000-4000-8000-000000000003', 'Child Other', 'CHILD_OTHER');

insert into public.memberships (user_id, tenant_id, role) values
  ('f0e10000-0000-4000-8000-000000000001', 'f0e00001-0000-4000-8000-000000000001', 'PROJECT_MANAGER'),
  ('f0e20000-0000-4000-8000-000000000002', 'f0e00002-0000-4000-8000-000000000002', 'WORKER'),
  ('f0e30000-0000-4000-8000-000000000003', 'f0e00003-0000-4000-8000-000000000003', 'WORKER'),
  ('f0e50000-0000-4000-8000-000000000005', 'f0e00002-0000-4000-8000-000000000002', 'WORKER');

insert into public.projects (id, tenant_id, site_name) values
  ('f0e11111-0000-4000-8000-000000000001', 'f0e00001-0000-4000-8000-000000000001', 'Child P1');

insert into public.project_companies (project_id, tenant_id, participation_type, status) values
  ('f0e11111-0000-4000-8000-000000000001', 'f0e00002-0000-4000-8000-000000000002', 'SUBCONTRACTOR', 'ACTIVE');

insert into public.project_memberships (id, user_id, project_id, tenant_id, role, scope) values
  ('f0ee0001-0000-4000-8000-000000000001', 'f0e10000-0000-4000-8000-000000000001', 'f0e11111-0000-4000-8000-000000000001', 'f0e00001-0000-4000-8000-000000000001', 'PROJECT_MANAGER', 'PROJECT'),
  ('f0ee0002-0000-4000-8000-000000000002', 'f0e20000-0000-4000-8000-000000000002', 'f0e11111-0000-4000-8000-000000000001', 'f0e00002-0000-4000-8000-000000000002', 'WORKER', 'PROJECT_COMPANY');

insert into public.workers (tenant_id, project_id, code, full_name, phone_number) values
  ('f0e00001-0000-4000-8000-000000000001', 'f0e11111-0000-4000-8000-000000000001', 'CHILD-W1', 'Child Worker', '0900000001');

-- Participating subcontractor user WITHOUT a project membership: project row is visible, child rows are not.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0e50000-0000-4000-8000-000000000005","role":"authenticated","tenant_id":"f0e00002-0000-4000-8000-000000000002"}', true);
select is(
  (select count(*)::int from public.project_companies where project_id = 'f0e11111-0000-4000-8000-000000000001'),
  0,
  'participant without membership: project_companies hidden (default deny)'
);
select is(
  (select count(*)::int from public.workers where tenant_id = 'f0e00001-0000-4000-8000-000000000001'),
  0,
  'subcontractor tenant user: main tenant roster hidden'
);
reset role;

-- Participating subcontractor user WITH a project membership.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0e20000-0000-4000-8000-000000000002","role":"authenticated","tenant_id":"f0e00002-0000-4000-8000-000000000002"}', true);
select is(
  (select count(*)::int from public.projects where id = 'f0e11111-0000-4000-8000-000000000001'),
  1,
  'participant with membership: project visible'
);
select is(
  (select count(*)::int from public.project_companies where project_id = 'f0e11111-0000-4000-8000-000000000001' and tenant_id = 'f0e00002-0000-4000-8000-000000000002'),
  1,
  'participant with membership: its own project_companies row visible'
);
select is(
  (select count(*)::int from public.project_memberships where project_id = 'f0e11111-0000-4000-8000-000000000001' and user_id <> 'f0e20000-0000-4000-8000-000000000002'),
  0,
  'participant with membership: other users memberships hidden'
);
select is(
  (select count(*)::int from public.workers where tenant_id = 'f0e00001-0000-4000-8000-000000000001'),
  0,
  'participant with membership: main tenant roster hidden (tenant isolation)'
);
reset role;

-- Non-participating tenant user sees neither the project nor its child rows.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0e30000-0000-4000-8000-000000000003","role":"authenticated","tenant_id":"f0e00003-0000-4000-8000-000000000003"}', true);
select is(
  (select count(*)::int from public.project_companies where project_id = 'f0e11111-0000-4000-8000-000000000001'),
  0,
  'non-participating tenant: project_companies hidden'
);
reset role;

-- Revoked project membership: project stays visible through the ACTIVE company, child rows are hidden.
delete from public.project_memberships where id = 'f0ee0002-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0e20000-0000-4000-8000-000000000002","role":"authenticated","tenant_id":"f0e00002-0000-4000-8000-000000000002"}', true);
select is(
  (select count(*)::int from public.projects where id = 'f0e11111-0000-4000-8000-000000000001'),
  1,
  'revoked membership: project still visible via ACTIVE company participation'
);
select is(
  (select count(*)::int from public.project_companies where project_id = 'f0e11111-0000-4000-8000-000000000001'),
  0,
  'revoked membership: project_companies hidden'
);
reset role;

select * from finish();

rollback;
