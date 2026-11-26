begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

-- Setup: two tenants, two users, two workers (one per tenant).
insert into auth.users (id) values
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
insert into public.tenants (id, name, code) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Attendance Tenant C', 'ATT_TEST_C'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Attendance Tenant D', 'ATT_TEST_D');
insert into public.memberships (user_id, tenant_id, role) values
  ('22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'SITE_MANAGER'),
  ('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'SITE_MANAGER');
insert into public.workers (tenant_id, code, full_name, phone_number) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'WATC001', 'Attendance Worker C', '0900000101'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'WATD001', 'Attendance Worker D', '0900000102');
insert into public.attendance (tenant_id, worker_id, work_date, status) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', (select id from public.workers where code = 'WATC001'), '2026-11-20', 'PRESENT');

-- User from tenant C is a manager.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","tenant_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","app_role":"SITE_MANAGER"}', true);

select is(
  (select count(*) from public.attendance),
  1::bigint,
  'attendance is visible only inside own tenant'
);

select throws_ok(
  $$insert into public.attendance (tenant_id, worker_id, work_date, status)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            (select id from public.workers where code = 'WATD001'),
            '2026-11-20', 'PRESENT')$$,
  '42501', null,
  'a manager cannot insert attendance into another tenant'
);

-- Duplicate (tenant, worker, date) must be rejected by the unique constraint.
select throws_ok(
  $$insert into public.attendance (tenant_id, worker_id, work_date, status)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            (select id from public.workers where code = 'WATC001'),
            '2026-11-20', 'ABSENT')$$,
  '23505', null,
  'a worker cannot have two attendance records on the same day'
);

-- Invalid status must be rejected by the check constraint.
select throws_ok(
  $$insert into public.attendance (tenant_id, worker_id, work_date, status)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            (select id from public.workers where code = 'WATC001'),
            '2026-11-21', 'BOGUS')$$,
  '23514', null,
  'invalid attendance status is rejected'
);

-- A worker from another tenant must not be referenceable (worker ownership check).
select throws_ok(
  $$insert into public.attendance (tenant_id, worker_id, work_date, status)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            (select id from public.workers where code = 'WATD001'),
            '2026-11-22', 'PRESENT')$$,
  '42501', null,
  'cannot record attendance for a worker outside the tenant'
);

-- Role gate: PROJECT_VIEWER cannot insert attendance. current_app_role() reads
-- the role from public.memberships (migration 014), not from the JWT claim.
-- Switch back to the session owner to mutate memberships (RLS blocks the update
-- while running as the authenticated role).
set role postgres;
update public.memberships set role = 'PROJECT_VIEWER'
where user_id = '22222222-2222-4222-8222-222222222222'
  and tenant_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set role authenticated;

select throws_ok(
  $$insert into public.attendance (tenant_id, worker_id, work_date, status)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            (select id from public.workers where code = 'WATC001'),
            '2026-11-23', 'PRESENT')$$,
  '42501', null,
  'PROJECT_VIEWER cannot insert attendance'
);

select * from finish();
rollback;