begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id) values
  ('f1111111-1111-4111-8111-111111111111'),
  ('f2222222-2222-4222-8222-222222222222'),
  ('f3333333-3333-4333-8333-333333333333');

insert into public.tenants (id, name, code) values
  ('f0111111-1111-4111-8111-111111111111', 'IPM Tenant', 'IPM_TEST_T1');

insert into public.memberships (user_id, tenant_id, role) values
  ('f1111111-1111-4111-8111-111111111111', 'f0111111-1111-4111-8111-111111111111', 'WORKER'),
  ('f3333333-3333-4333-8333-333333333333', 'f0111111-1111-4111-8111-111111111111', 'WORKER');

insert into public.projects (id, tenant_id, site_name) values
  ('f0211111-1111-4111-8111-111111111111', 'f0111111-1111-4111-8111-111111111111', 'IPM Active Project');

insert into public.project_memberships (user_id, project_id, tenant_id, role, scope) values
  ('f1111111-1111-4111-8111-111111111111', 'f0211111-1111-4111-8111-111111111111', 'f0111111-1111-4111-8111-111111111111', 'WORKER', 'PROJECT'),
  ('f3333333-3333-4333-8333-333333333333', 'f0211111-1111-4111-8111-111111111111', 'f0111111-1111-4111-8111-111111111111', 'WORKER', 'PROJECT');

-- Revocation is a row delete: remove the membership of f3333... before switching role.
delete from public.project_memberships
where user_id = 'f3333333-3333-4333-8333-333333333333'
  and project_id = 'f0211111-1111-4111-8111-111111111111';

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated","app_role":"WORKER","tenant_id":"f0111111-1111-4111-8111-111111111111"}', true);

select ok(
  public.is_project_member('f0211111-1111-4111-8111-111111111111'),
  'active project: a valid member is recognised'
);

select is(
  (select count(*) from public.project_companies where project_id = 'f0211111-1111-4111-8111-111111111111'),
  1::bigint,
  'active project: member sees the project companies through the policy that depends on the helper'
);

select set_config('request.jwt.claims', '{"sub":"f2222222-2222-4222-8222-222222222222","role":"authenticated","app_role":"WORKER","tenant_id":"f0111111-1111-4111-8111-111111111111"}', true);

select ok(
  not public.is_project_member('f0211111-1111-4111-8111-111111111111'),
  'user outside the project is not recognised as a member'
);

select set_config('request.jwt.claims', '{"sub":"f3333333-3333-4333-8333-333333333333","role":"authenticated","app_role":"WORKER","tenant_id":"f0111111-1111-4111-8111-111111111111"}', true);

select ok(
  not public.is_project_member('f0211111-1111-4111-8111-111111111111'),
  'revoked membership (row removed) is no longer recognised'
);

select * from finish();
rollback;
