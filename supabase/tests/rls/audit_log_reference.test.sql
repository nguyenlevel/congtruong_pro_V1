begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id) values
  ('c1111111-1111-4111-8111-111111111111'),
  ('c2222222-2222-4222-8222-222222222222');

insert into public.tenants (id, name, code) values
  ('d1111111-1111-4111-8111-111111111111', 'Ref Tenant A', 'REF_TEST_A'),
  ('d2222222-2222-4222-8222-222222222222', 'Ref Tenant B', 'REF_TEST_B');

insert into public.memberships (user_id, tenant_id, role) values
  ('c1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111', 'SYS_ADMIN'),
  ('c2222222-2222-4222-8222-222222222222', 'd2222222-2222-4222-8222-222222222222', 'SYS_ADMIN');

insert into public.projects (id, tenant_id, site_name) values
  ('e1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111', 'Ref Project P1 (tenant A)'),
  ('e2222222-2222-4222-8222-222222222222', 'd2222222-2222-4222-8222-222222222222', 'Ref Project P2 (tenant B)'),
  ('e3333333-3333-4333-8333-333333333333', 'd1111111-1111-4111-8111-111111111111', 'Ref Project P3 (deleted)');

update public.projects set deleted_at = now() where id = 'e3333333-3333-4333-8333-333333333333';

-- Project creation trigger adds the owning tenant as MAIN_CONTRACTOR (project_companies).
insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values
  ('c1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111', 'PROJECT_VIEWER', 'PROJECT'),
  ('c1111111-1111-4111-8111-111111111111', 'e3333333-3333-4333-8333-333333333333', 'd1111111-1111-4111-8111-111111111111', 'PROJECT_VIEWER', 'PROJECT'),
  ('c2222222-2222-4222-8222-222222222222', 'e2222222-2222-4222-8222-222222222222', 'd2222222-2222-4222-8222-222222222222', 'PROJECT_VIEWER', 'PROJECT');

-- Temporary id lookup, filled as the owner before switching role.
create temp table ref_ids (k text primary key, v uuid);
grant select on ref_ids to authenticated;
insert into ref_ids (k, v)
select 'pc_p1', pc.id from public.project_companies pc where pc.project_id = 'e1111111-1111-4111-8111-111111111111'
union all
select 'pc_p2', pc.id from public.project_companies pc where pc.project_id = 'e2222222-2222-4222-8222-222222222222';

-- Actor c1 also belongs to tenant B so that the tenant/project mismatch branch is reachable.
insert into public.memberships (user_id, tenant_id, role) values
  ('c1111111-1111-4111-8111-111111111111', 'd2222222-2222-4222-8222-222222222222', 'SYS_ADMIN');

select set_config('request.jwt.claims', '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.write_audit('project_member.added', 'tenant', 'x', 'd1111111-1111-4111-8111-111111111111', null, null, '{"reason":"ok"}', 'ref-1')$$,
  'tenant-only scope is accepted for a tenant member'
);

select lives_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'e1111111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'ref-2')$$,
  'project-only scope is accepted for a project member'
);

select lives_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', 'd1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111',
      (select v from ref_ids where k = 'pc_p1'), '{"reason":"ok"}', 'ref-3')$$,
  'project_company that belongs to the project is accepted'
);

select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', 'd1111111-1111-4111-8111-111111111111', null,
      (select v from ref_ids where k = 'pc_p1'), '{"reason":"ok"}', 'ref-4')$$,
  '22023', null, 'project_company without project_id is rejected'
);

select throws_ok(
  $$select public.  write_audit('project_member.added', 'project', 'x', null, 'e1111111-1111-4111-8111-111111111111',
      (select v from ref_ids where k = 'pc_p2'), '{"reason":"ok"}', 'ref-5')$$,
  '22023', null, 'project_company of another project is rejected even when both exist'
);

select throws_ok(
  $$select public.  write_audit('project_member.added', 'project', 'x', null, 'e1111111-1111-4111-8111-111111111111',
      'ffffffff-ffff-4fff-8fff-ffffffffffff', '{"reason":"ok"}', 'ref-6')$$,
  '22023', null, 'non-existent project_company is rejected'
);

select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', 'd2222222-2222-4222-8222-222222222222', 'e1111111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'ref-7')$$,
  '22023', null, 'tenant that does not own the project is rejected'
);

select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'e2222222-2222-4222-8222-222222222222', null, '{"reason":"ok"}', 'ref-8')$$,
  '42501', null, 'actor who is not a member of the project is rejected'
);

select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'e3333333-3333-4333-8333-333333333333', null, '{"reason":"ok"}', 'ref-9')$$,
  '22023', null, 'soft-deleted project is rejected'
);

reset role;
delete from public.project_memberships
where user_id = 'c1111111-1111-4111-8111-111111111111' and project_id = 'e1111111-1111-4111-8111-111111111111';
set local role authenticated;

select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'e1111111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'ref-10')$$,
  '42501', null, 'revoked project membership cannot write audit'
);

reset role;

select * from finish();
rollback;
