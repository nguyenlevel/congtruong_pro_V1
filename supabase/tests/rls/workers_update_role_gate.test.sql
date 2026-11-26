begin;

create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (id) values
  ('d1111111-1111-4111-8111-111111111111'),
  ('d2222222-2222-4222-8222-222222222222');

insert into public.tenants (id, name, code) values
  ('d0111111-1111-4111-8111-111111111111', 'WK Gate Tenant', 'WK_GATE_T1');

insert into public.memberships (user_id, tenant_id, role) values
  ('d1111111-1111-4111-8111-111111111111', 'd0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('d2222222-2222-4222-8222-222222222222', 'd0111111-1111-4111-8111-111111111111', 'SITE_MANAGER');

insert into public.workers (id, tenant_id, code, full_name, phone_number) values
  ('d0311111-1111-4111-8111-111111111111', 'd0111111-1111-4111-8111-111111111111', 'WK-GATE-1', 'Gate Roster Worker', '0900000002');

set local role authenticated;

-- 1. WORKER cannot update the roster.
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"WORKER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
do $$
declare n int;
begin
  update public.workers set full_name = 'changed by worker' where id = 'd0311111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  perform set_config('test.wk_worker_rows', n::text, true);
end $$;
select is(current_setting('test.wk_worker_rows'), '0', 'WORKER cannot update workers roster');

-- 2. SITE_MANAGER can update the roster in own tenant.
select set_config('request.jwt.claims', '{"sub":"d2222222-2222-4222-8222-222222222222","role":"authenticated","app_role":"SITE_MANAGER","tenant_id":"d0111111-1111-4111-8111-111111111111"}', true);
do $$
declare n int;
begin
  update public.workers set full_name = 'changed by manager' where id = 'd0311111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  perform set_config('test.wk_manager_rows', n::text, true);
end $$;
select is(current_setting('test.wk_manager_rows'), '1', 'SITE_MANAGER can update workers roster in own tenant');

select * from finish();
rollback;
