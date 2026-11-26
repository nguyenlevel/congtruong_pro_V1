begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id) values
  ('e2600000-0000-4000-8000-000000000001'),
  ('e2600000-0000-4000-8000-000000000002'),
  ('e2600000-0000-4000-8000-000000000003'),
  ('e2600000-0000-4000-8000-000000000004'),
  ('e2600000-0000-4000-8000-000000000005');

insert into public.tenants (id, name, code) values
  ('e2600001-0000-4000-8000-000000000001', 'P26 Main', 'P26_MAIN'),
  ('e2600002-0000-4000-8000-000000000002', 'P26 Sub', 'P26_SUB'),
  ('e2600003-0000-4000-8000-000000000003', 'P26 Susp', 'P26_SUSP'),
  ('e2600004-0000-4000-8000-000000000004', 'P26 Other', 'P26_OTHER');

insert into public.memberships (user_id, tenant_id, role) values
  ('e2600000-0000-4000-8000-000000000001', 'e2600001-0000-4000-8000-000000000001', 'PROJECT_MANAGER'),
  ('e2600000-0000-4000-8000-000000000002', 'e2600002-0000-4000-8000-000000000002', 'WORKER'),
  ('e2600000-0000-4000-8000-000000000003', 'e2600002-0000-4000-8000-000000000002', 'WORKER'),
  ('e2600000-0000-4000-8000-000000000004', 'e2600002-0000-4000-8000-000000000002', 'SUB_CONTRACTOR'),
  ('e2600000-0000-4000-8000-000000000005', 'e2600001-0000-4000-8000-000000000001', 'PROJECT_VIEWER');

insert into public.projects (id, tenant_id, site_name) values
  ('e2611111-0000-4000-8000-000000000001', 'e2600001-0000-4000-8000-000000000001', 'P26 managed'),
  ('e2622222-0000-4000-8000-000000000002', 'e2600001-0000-4000-8000-000000000001', 'P26 not managed');

insert into public.project_companies (project_id, tenant_id, participation_type, status) values
  ('e2611111-0000-4000-8000-000000000001', 'e2600002-0000-4000-8000-000000000002', 'SUBCONTRACTOR', 'ACTIVE'),
  ('e2611111-0000-4000-8000-000000000001', 'e2600003-0000-4000-8000-000000000003', 'SUBCONTRACTOR', 'SUSPENDED'),
  ('e2622222-0000-4000-8000-000000000002', 'e2600004-0000-4000-8000-000000000004', 'SUBCONTRACTOR', 'ACTIVE');

insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values
  ('e2600000-0000-4000-8000-000000000001', 'e2611111-0000-4000-8000-000000000001', 'e2600001-0000-4000-8000-000000000001', 'PROJECT_MANAGER', 'PROJECT');

insert into public.workers (id, tenant_id, project_id, code, full_name, phone_number, user_id) values
  ('e2699999-0000-4000-8000-000000000001', 'e2600002-0000-4000-8000-000000000002', null, 'W1', 'Own Worker', '0900000001', 'e2600000-0000-4000-8000-000000000002'),
  ('e2699999-0000-4000-8000-000000000002', 'e2600002-0000-4000-8000-000000000002', null, 'W2', 'Other Worker', '0900000002', 'e2600000-0000-4000-8000-000000000003'),
  ('e2699999-0000-4000-8000-000000000003', 'e2600004-0000-4000-8000-000000000004', null, 'W3', 'Unmanaged project worker', '0900000003', null),
  ('e2699999-0000-4000-8000-000000000004', 'e2600003-0000-4000-8000-000000000003', null, 'W4', 'Suspended company worker', '0900000004', null);

insert into public.attendance (id, tenant_id, project_id, worker_id, work_date) values
  ('e26aaaaa-0000-4000-8000-000000000001', 'e2600002-0000-4000-8000-000000000002', null, 'e2699999-0000-4000-8000-000000000001', '2026-11-20'),
  ('e26aaaaa-0000-4000-8000-000000000002', 'e2600002-0000-4000-8000-000000000002', null, 'e2699999-0000-4000-8000-000000000002', '2026-11-20');

-- PROJECT_MANAGER reads the roster of ACTIVE companies in a managed project only.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2600000-0000-4000-8000-000000000001","role":"authenticated","tenant_id":"e2600001-0000-4000-8000-000000000001"}', true);

select is((select count(*)::int from public.workers), 2, 'PM sees workers of the ACTIVE company in the managed project only');
select is(
  (select count(*)::int from public.workers where code in ('W3', 'W4')),
  0,
  'PM does not see unmanaged-project or SUSPENDED-company workers'
);
select is((select count(*)::int from public.attendance), 0, 'PM does not read attendance (roster only)');
update public.workers set full_name = 'x' where id = 'e2699999-0000-4000-8000-000000000001';
reset role;
select is(
  (select full_name from public.workers where id = 'e2699999-0000-4000-8000-000000000001'),
  'Own Worker',
  'PM cannot update workers'
);
set local role authenticated;

-- WORKER reads only own record and own attendance.
select set_config('request.jwt.claims', '{"sub":"e2600000-0000-4000-8000-000000000002","role":"authenticated","tenant_id":"e2600002-0000-4000-8000-000000000002"}', true);
select is((select count(*)::int from public.workers), 1, 'WORKER sees only own roster record');
select is((select full_name from public.workers), 'Own Worker', 'WORKER sees the right record');
select is((select count(*)::int from public.attendance), 1, 'WORKER sees only own attendance');
select is(
  (select count(*)::int from public.attendance where worker_id = 'e2699999-0000-4000-8000-000000000002'),
  0,
  'WORKER cannot see a colleague attendance'
);

-- PROJECT_VIEWER keeps tenant-wide read of attendance; SUB_CONTRACTOR keeps roster access.
select set_config('request.jwt.claims', '{"sub":"e2600000-0000-4000-8000-000000000004","role":"authenticated","tenant_id":"e2600002-0000-4000-8000-000000000002"}', true);
select is((select count(*)::int from public.attendance), 2, 'SUB_CONTRACTOR still reads tenant attendance');
select is((select count(*)::int from public.workers where tenant_id = 'e2600002-0000-4000-8000-000000000002'), 2, 'SUB_CONTRACTOR still reads tenant roster');

-- Least privilege grants.
reset role;
select ok(not has_table_privilege('anon', 'public.workers', 'SELECT'), 'anon has no SELECT on workers');
select ok(not has_table_privilege('anon', 'public.tenants', 'SELECT'), 'anon has no SELECT on tenants');
select ok(not has_table_privilege('authenticated', 'public.workers', 'TRUNCATE'), 'authenticated has no TRUNCATE on workers');
select ok(has_table_privilege('authenticated', 'public.workers', 'SELECT'), 'authenticated keeps SELECT on workers');
select ok(has_table_privilege('service_role', 'public.workers', 'TRUNCATE'), 'service_role keeps full access');
select is(
  (select count(*)::int
     from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.grantee = 'anon'),
  0,
  'anon holds no table grants in public'
);

select * from finish();
rollback;
