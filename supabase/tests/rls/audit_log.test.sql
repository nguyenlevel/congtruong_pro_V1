begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id) values
  ('a1111111-1111-4111-8111-111111111111'),
  ('a2222222-2222-4222-8222-222222222222');

insert into public.tenants (id, name, code) values
  ('b1111111-1111-4111-8111-111111111111', 'Audit Tenant A', 'AUD_TEST_A'),
  ('b2222222-2222-4222-8222-222222222222', 'Audit Tenant B', 'AUD_TEST_B');

insert into public.memberships (user_id, tenant_id, role) values
  ('a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'SYS_ADMIN'),
  ('a2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'SYS_ADMIN');

-- Seed one row as the table owner (the only way to write without write_audit).
insert into public.audit_log (action, tenant_id, payload)
values ('seed', 'b1111111-1111-4111-8111-111111111111', '{}');

select throws_ok(
  $$update public.audit_log set action = 'changed'$$,
  'P0001', null, 'audit rows cannot be updated, even by the table owner'
);

select throws_ok(
  $$delete from public.audit_log$$,
  'P0001', null, 'audit rows cannot be deleted, even by the table owner'
);

select throws_ok(
  $$truncate public.audit_log$$,
  'P0001', null, 'audit_log cannot be truncated'
);

select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$update public.audit_log set action = 'changed'$$,
  '42501', null, 'authenticated role has no update grant on audit_log'
);

select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', 'b2222222-2222-4222-8222-222222222222', null, null, '{}', null)$$,
  '42501', null, 'write_audit rejects an actor outside the target tenant'
);

select throws_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', 'b1111111-1111-4111-8111-111111111111', null, null, '{"full_name":"x"}', null)$$,
  '22023', null, 'write_audit rejects payload keys outside the allowlist'
);

select lives_ok(
  $$select public.write_audit('project_member.added', 'project', 'x', 'b1111111-1111-4111-8111-111111111111', null, null, '{"reason":"ok"}', 'req-1')$$,
  'write_audit accepts an allowlisted payload from a tenant member'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.audit_log),
  0,
  'a user from another tenant cannot read the audit rows of tenant A'
);

reset role;

select * from finish();
rollback;
