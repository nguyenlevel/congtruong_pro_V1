begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id) values
  ('a1111111-1111-4111-8111-111111111111'),
  ('a2222222-2222-4222-8222-222222222222'),
  ('a3333333-3333-4333-8333-333333333333'),
  ('a4444444-4444-4444-8444-444444444444');

insert into public.tenants (id, name, code) values
  ('a0111111-1111-4111-8111-111111111111', 'WA Tenant T1', 'WA_TEST_T1'),
  ('a0222222-2222-4222-8222-222222222222', 'WA Tenant T2', 'WA_TEST_T2');

insert into public.memberships (user_id, tenant_id, role) values
  ('a1111111-1111-4111-8111-111111111111', 'a0111111-1111-4111-8111-111111111111', 'SYS_ADMIN'),
  ('a2222222-2222-4222-8222-222222222222', 'a0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('a3333333-3333-4333-8333-333333333333', 'a0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('a4444444-4444-4444-8444-444444444444', 'a0222222-2222-4222-8222-222222222222', 'SYS_ADMIN');

insert into public.projects (id, tenant_id, site_name) values
  ('a0211111-1111-4111-8111-111111111111', 'a0111111-1111-4111-8111-111111111111', 'WA Active Project'),
  ('a0212222-2222-4222-8222-222222222222', 'a0111111-1111-4111-8111-111111111111', 'WA Deleted Project');

-- Valid members of both projects, and a revoked member (r1) of both projects.
insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values
  ('a1111111-1111-4111-8111-111111111111', 'a0211111-1111-4111-8111-111111111111', 'a0111111-1111-4111-8111-111111111111', 'PROJECT_VIEWER', 'PROJECT'),
  ('a1111111-1111-4111-8111-111111111111', 'a0212222-2222-4222-8222-222222222222', 'a0111111-1111-4111-8111-111111111111', 'PROJECT_VIEWER', 'PROJECT'),
  ('a3333333-3333-4333-8333-333333333333', 'a0211111-1111-4111-8111-111111111111', 'a0111111-1111-4111-8111-111111111111', 'PROJECT_VIEWER', 'PROJECT'),
  ('a3333333-3333-4333-8333-333333333333', 'a0212222-2222-4222-8222-222222222222', 'a0111111-1111-4111-8111-111111111111', 'PROJECT_VIEWER', 'PROJECT');

-- Soft-delete the deleted project, then revoke r1 by row delete (revocation = row removal).
update public.projects set deleted_at = now() where id = 'a0212222-2222-4222-8222-222222222222';
delete from public.project_memberships
where user_id = 'a3333333-3333-4333-8333-333333333333';

set local role authenticated;

-- 1. valid member + active project -> audit row is written.
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SYS_ADMIN","tenant_id":"a0111111-1111-4111-8111-111111111111"}', true);
select lives_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'a0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'wa-1')$$,
  'valid member + active project: audit is written'
);

-- 2. valid member + deleted project -> 22023 (ref-9 contract, only reachable for real members).
select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'a0212222-2222-4222-8222-222222222222', null, '{"reason":"ok"}', 'wa-2')$$,
  '22023', null, 'valid member + deleted project: rejected with 22023'
);

-- 3-4. non-member (n1) cannot distinguish active from deleted: both 42501.
select set_config('request.jwt.claims', '{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated","app_role":"WORKER","tenant_id":"a0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'a0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'wa-3')$$,
  '42501', null, 'non-member + active project: rejected with 42501'
);
select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'a0212222-2222-4222-8222-222222222222', null, '{"reason":"ok"}', 'wa-4')$$,
  '42501', null, 'non-member + deleted project: rejected with 42501 (no state leak)'
);

-- 5-6. revoked member (r1) cannot distinguish active from deleted: both 42501.
select set_config('request.jwt.claims', '{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated","app_role":"WORKER","tenant_id":"a0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'a0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'wa-5')$$,
  '42501', null, 'revoked membership + active project: rejected with 42501'
);
select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'a0212222-2222-4222-8222-222222222222', null, '{"reason":"ok"}', 'wa-6')$$,
  '42501', null, 'revoked membership + deleted project: rejected with 42501'
);

-- 7. project does not exist: 42501 (same as non-member, so existence is not revealed).
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SYS_ADMIN","tenant_id":"a0111111-1111-4111-8111-111111111111"}', true);
select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'ffffffff-ffff-4fff-8fff-ffffffffffff', null, '{"reason":"ok"}', 'wa-7')$$,
  '42501', null, 'non-existent project: rejected with 42501'
);

-- 8. wrong tenant: actor is not a member of tenant T2 -> 42501, no audit row.
select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', 'a0222222-2222-4222-8222-222222222222', 'a0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'wa-8')$$,
  '42501', null, 'tenant the actor does not belong to: rejected with 42501'
);

-- 9. other-tenant user (u2, tenant T2) with no project membership cannot write to T1 project.
select set_config('request.jwt.claims', '{"sub":"a4444444-4444-4444-8444-444444444444","role":"authenticated","app_role":"SYS_ADMIN","tenant_id":"a0222222-2222-4222-8222-222222222222"}', true);
select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'a0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'wa-9')$$,
  '42501', null, 'other-tenant user: cannot write audit for a T1 project'
);

-- 10-11. other-tenant user cannot see or detect T1 project membership, via helper and RLS.
select ok(
  not public.is_project_member('a0211111-1111-4111-8111-111111111111'),
  'other-tenant user: is_project_member is FALSE for T1 project'
);
select is(
  (select count(*) from public.projects where id = 'a0211111-1111-4111-8111-111111111111'),
  0::bigint,
  'other-tenant user: RLS hides the T1 project row'
);

reset role;

-- 12. exactly one audit row was written for the valid-member call, with correct project and request.
select is(
  (select count(*) from public.audit_log
   where request_id = 'wa-1' and project_id = 'a0211111-1111-4111-8111-111111111111'),
  1::bigint,
  'valid member + active project: exactly one audit row written for request wa-1'
);

select * from finish();
rollback;
