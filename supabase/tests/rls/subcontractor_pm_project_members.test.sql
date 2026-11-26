begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

-- Owner decision (2026-11-23): a PROJECT_MANAGER of a SUBCONTRACTOR company must not manage Project Members.
-- It may not list the full member roster, add, change or remove memberships, and must not write
-- project_memberships directly. Enforcement is in RLS and in the RPCs, not only in the UI.

insert into auth.users (id) values
  ('f8111111-1111-4111-8111-111111111111'),
  ('f8222222-2222-4222-8222-222222222222'),
  ('f8333333-3333-4333-8333-333333333333'),
  ('f8444444-4444-4444-8444-444444444444');

insert into public.tenants (id, name, code) values
  ('f8c11111-1111-4111-8111-111111111111', 'SUBPM Main', 'SUBPM_MAIN'),
  ('f8c22222-2222-4222-8222-222222222222', 'SUBPM Sub', 'SUBPM_SUB');

insert into public.memberships (user_id, tenant_id, role) values
  ('f8111111-1111-4111-8111-111111111111', 'f8c11111-1111-4111-8111-111111111111', 'PROJECT_MANAGER'),
  ('f8222222-2222-4222-8222-222222222222', 'f8c22222-2222-4222-8222-222222222222', 'PROJECT_MANAGER'),
  ('f8333333-3333-4333-8333-333333333333', 'f8c22222-2222-4222-8222-222222222222', 'WORKER'),
  ('f8444444-4444-4444-8444-444444444444', 'f8c22222-2222-4222-8222-222222222222', 'WORKER');

insert into public.projects (id, tenant_id, site_name) values
  ('f8c31111-1111-4111-8111-111111111111', 'f8c11111-1111-4111-8111-111111111111', 'SUBPM Site');

insert into public.project_companies (project_id, tenant_id, participation_type, status) values
  ('f8c31111-1111-4111-8111-111111111111', 'f8c22222-2222-4222-8222-222222222222', 'SUBCONTRACTOR', 'ACTIVE');

-- The MAIN PM is a PROJECT_MANAGER of the MAIN_CONTRACTOR assigned to this project.
-- The SUB PM holds a PROJECT_MANAGER project membership in its own company (the case under test).
insert into public.project_memberships (id, user_id, project_id, tenant_id, role, scope) values
  ('f8cd0001-0001-4001-8001-000000000001', 'f8111111-1111-4111-8111-111111111111', 'f8c31111-1111-4111-8111-111111111111', 'f8c11111-1111-4111-8111-111111111111', 'PROJECT_MANAGER', 'PROJECT'),
  ('f8cd0002-0002-4002-8002-000000000002', 'f8222222-2222-4222-8222-222222222222', 'f8c31111-1111-4111-8111-111111111111', 'f8c22222-2222-4222-8222-222222222222', 'PROJECT_MANAGER', 'PROJECT_COMPANY'),
  ('f8cd0003-0003-4003-8003-000000000003', 'f8333333-3333-4333-8333-333333333333', 'f8c31111-1111-4111-8111-111111111111', 'f8c22222-2222-4222-8222-222222222222', 'WORKER', 'PROJECT_COMPANY');

-- t1: a SUB PM with a PROJECT_MANAGER membership is not a main-contractor manager.
select ok(
  not public.is_main_contractor_manager('f8c31111-1111-4111-8111-111111111111'),
  'sub project manager: is not a main contractor manager of the project'
);

-- t2: a SUB PM sees only its own project membership row, not the full roster.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.project_memberships where project_id = 'f8c31111-1111-4111-8111-111111111111'),
  1,
  'sub project manager: reads only its own project membership, not the full roster'
);
reset role;

-- t3: the main PM still reads the full roster (control case).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.project_memberships where project_id = 'f8c31111-1111-4111-8111-111111111111'),
  3,
  'main project manager: reads the full project roster'
);
reset role;

-- t4: a SUB PM cannot add a member through the RPC.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$select public.add_project_member('f8c31111-1111-4111-8111-111111111111', (select id from public.project_companies where project_id = 'f8c31111-1111-4111-8111-111111111111' and tenant_id = 'f8c22222-2222-4222-8222-222222222222'), 'f8444444-4444-4444-8444-444444444444', 'WORKER')$$,
  '42501',
  'not allowed to manage project members',
  'sub project manager: cannot add a project member through add_project_member'
);
reset role;

-- t5: a SUB PM cannot change the role of a member through the RPC.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$select public.update_project_member_role('f8cd0003-0003-4003-8003-000000000003', 'PROJECT_VIEWER')$$,
  '42501',
  'not allowed to manage project members',
  'sub project manager: cannot change a member role through update_project_member_role'
);
reset role;

-- t6: a SUB PM cannot remove a membership through the RPC.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$select public.remove_project_member('f8cd0003-0003-4003-8003-000000000003')$$,
  '42501',
  'not allowed to manage project members',
  'sub project manager: cannot remove a membership through remove_project_member'
);
reset role;

-- t7: a SUB PM cannot insert project_memberships directly through the REST/table path.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values ('f8444444-4444-4444-8444-444444444444', 'f8c31111-1111-4111-8111-111111111111', 'f8c22222-2222-4222-8222-222222222222', 'PROJECT_VIEWER', 'PROJECT_COMPANY')$$,
  '42501',
  null,
  'sub project manager: cannot insert a project membership directly'
);
reset role;

-- t8: a SUB PM cannot update a membership directly (zero rows affected).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select lives_ok(
  $$ do $b$
     declare n int;
     begin
       update public.project_memberships set role = 'PROJECT_MANAGER'
        where id = 'f8cd0003-0003-4003-8003-000000000003';
       get diagnostics n = row_count;
       if n <> 0 then raise exception 'rows affected: %', n; end if;
     end $b$ $$,
  'sub project manager: direct update of a membership affects no rows'
);
reset role;

-- t9: a SUB PM cannot delete a membership directly (zero rows affected).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select lives_ok(
  $$ do $b$
     declare n int;
     begin
       delete from public.project_memberships
        where id = 'f8cd0003-0003-4003-8003-000000000003';
       get diagnostics n = row_count;
       if n <> 0 then raise exception 'rows affected: %', n; end if;
     end $b$ $$,
  'sub project manager: direct delete of a membership affects no rows'
);
reset role;

-- t10: the rows targeted in t5-t9 are unchanged (checked as owner, after the attempts).
select is(
  (select role from public.project_memberships where id = 'f8cd0003-0003-4003-8003-000000000003'),
  'WORKER',
  'sub project manager: attempted changes left the member role unchanged'
);

-- t11: control: the main PM can change a member role within its project.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.update_project_member_role('f8cd0003-0003-4003-8003-000000000003', 'PROJECT_VIEWER')$$,
  'main project manager: can change a member role within its project'
);
reset role;

select * from finish();
rollback;
