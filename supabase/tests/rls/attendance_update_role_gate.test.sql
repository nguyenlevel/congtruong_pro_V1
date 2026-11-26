begin;

create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id) values
  ('c1111111-1111-4111-8111-111111111111'),
  ('c2222222-2222-4222-8222-222222222222'),
  ('c3333333-3333-4333-8333-333333333333');

insert into public.tenants (id, name, code) values
  ('c0111111-1111-4111-8111-111111111111', 'ATT Gate Tenant', 'ATT_GATE_T1');

insert into public.memberships (user_id, tenant_id, role) values
  ('c1111111-1111-4111-8111-111111111111', 'c0111111-1111-4111-8111-111111111111', 'SITE_MANAGER'),
  ('c2222222-2222-4222-8222-222222222222', 'c0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('c3333333-3333-4333-8333-333333333333', 'c0111111-1111-4111-8111-111111111111', 'PROJECT_VIEWER');

insert into public.workers (id, tenant_id, code, full_name, phone_number) values
  ('c0311111-1111-4111-8111-111111111111', 'c0111111-1111-4111-8111-111111111111', 'ATT-W1', 'Gate Worker', '0900000001');

insert into public.attendance (id, tenant_id, worker_id, work_date, status) values
  ('c0411111-1111-4111-8111-111111111111', 'c0111111-1111-4111-8111-111111111111', 'c0311111-1111-4111-8111-111111111111', '2026-11-23', 'PRESENT');

set local role authenticated;

-- 1. WORKER cannot update attendance.
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated","app_role":"WORKER","tenant_id":"c0111111-1111-4111-8111-111111111111"}', true);
do $$
declare n int;
begin
  update public.attendance set note = 'by worker' where id = 'c0411111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  perform set_config('test.att_worker_rows', n::text, true);
end $$;
select is(current_setting('test.att_worker_rows'), '0', 'WORKER cannot update attendance');

-- 2. PROJECT_VIEWER cannot update attendance.
select set_config('request.jwt.claims', '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated","app_role":"PROJECT_VIEWER","tenant_id":"c0111111-1111-4111-8111-111111111111"}', true);
do $$
declare n int;
begin
  update public.attendance set note = 'by viewer' where id = 'c0411111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  perform set_config('test.att_viewer_rows', n::text, true);
end $$;
select is(current_setting('test.att_viewer_rows'), '0', 'PROJECT_VIEWER cannot update attendance');

-- 3. SITE_MANAGER can still update attendance in own tenant.
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SITE_MANAGER","tenant_id":"c0111111-1111-4111-8111-111111111111"}', true);
do $$
declare n int;
begin
  update public.attendance set note = 'by manager' where id = 'c0411111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  perform set_config('test.att_manager_rows', n::text, true);
end $$;
select is(current_setting('test.att_manager_rows'), '1', 'SITE_MANAGER can update attendance in own tenant');

select * from finish();
rollback;
