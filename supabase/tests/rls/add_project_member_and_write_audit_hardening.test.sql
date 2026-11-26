begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

-- add_project_member: single overload, definer, pinned search_path, EXECUTE only for authenticated.
select is(
  (select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'add_project_member'),
  1,
  'add_project_member has exactly one overload'
);
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.add_project_member(uuid,uuid,uuid,text)'::regprocedure),
  'add_project_member is SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'public.add_project_member(uuid,uuid,uuid,text)'::regprocedure),
  'add_project_member pins search_path to empty'
);
select ok(
  has_function_privilege('authenticated', 'public.add_project_member(uuid,uuid,uuid,text)', 'EXECUTE'),
  'authenticated can execute add_project_member'
);
select ok(
  not has_function_privilege('anon', 'public.add_project_member(uuid,uuid,uuid,text)', 'EXECUTE'),
  'anon cannot execute add_project_member'
);
select ok(
  not has_function_privilege('public', 'public.add_project_member(uuid,uuid,uuid,text)', 'EXECUTE'),
  'PUBLIC cannot execute add_project_member'
);

-- write_audit: privileges and allowlist.
select ok(
  not has_function_privilege('anon', 'public.write_audit(text,text,text,uuid,uuid,uuid,jsonb,text)', 'EXECUTE'),
  'anon cannot execute write_audit'
);
select ok(
  not has_function_privilege('public', 'public.write_audit(text,text,text,uuid,uuid,uuid,jsonb,text)', 'EXECUTE'),
  'PUBLIC cannot execute write_audit'
);

insert into auth.users (id) values ('b1111111-1111-4111-8111-111111111111');
insert into public.tenants (id, name, code) values
  ('b0111111-1111-4111-8111-111111111111', 'AL Tenant', 'AL_TEST_T1');
insert into public.memberships (user_id, tenant_id, role) values
  ('b1111111-1111-4111-8111-111111111111', 'b0111111-1111-4111-8111-111111111111', 'SYS_ADMIN');
insert into public.projects (id, tenant_id, site_name) values
  ('b0211111-1111-4111-8111-111111111111', 'b0111111-1111-4111-8111-111111111111', 'AL Project');
insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values
  ('b1111111-1111-4111-8111-111111111111', 'b0211111-1111-4111-8111-111111111111', 'b0111111-1111-4111-8111-111111111111', 'PROJECT_VIEWER', 'PROJECT');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"SYS_ADMIN","tenant_id":"b0111111-1111-4111-8111-111111111111"}', true);

select throws_ok(
  $$select public.write_audit('FAKE_ACTION', 'project', 'x', null, 'b0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'al-fake')$$,
  '22023', 'audit action is not allowed', 'unknown action is rejected by allowlist'
);

select lives_ok(
  $$select public.write_audit('project_company.added', 'project', 'x', null, 'b0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'al-1')$$,
  'allowlisted action project_company.added is accepted'
);
select lives_ok(
  $$select public.write_audit('project_company.type_changed', 'project', 'x', null, 'b0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'al-2')$$,
  'allowlisted action project_company.type_changed is accepted'
);
select lives_ok(
  $$select public.write_audit('project_company.activated', 'project', 'x', null, 'b0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'al-3')$$,
  'allowlisted action project_company.activated is accepted'
);
select lives_ok(
  $$select public.write_audit('project_company.suspended', 'project', 'x', null, 'b0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'al-4')$$,
  'allowlisted action project_company.suspended is accepted'
);
select lives_ok(
  $$select public.write_audit('project_company.ended', 'project', 'x', null, 'b0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'al-5')$$,
  'allowlisted action project_company.ended is accepted'
);
select lives_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', null, 'b0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'al-6')$$,
  'allowlisted action project_member.added is accepted'
);
select lives_ok(
  $$select public.write_audit('project_member.role_updated', 'project', 'x', null, 'b0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'al-7')$$,
  'allowlisted action project_member.role_updated is accepted'
);
select lives_ok(
  $$select public.write_audit('project_member.removed', 'project', 'x', null, 'b0211111-1111-4111-8111-111111111111', null, '{"reason":"ok"}', 'al-8')$$,
  'allowlisted action project_member.removed is accepted'
);

select * from finish();
rollback;
