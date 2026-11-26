-- Migration 018: add the PROJECT_MANAGER role (owner decision, plan A).
-- SITE_MANAGER is kept as a legacy role: it is not renamed, not removed, and no membership
-- is reassigned automatically (ADR-001 D-SM-M1).
-- 1. PROJECT_MANAGER is added to roles and to role_permissions (ADR-001 permission matrix).
-- 2. is_main_contractor_manager accepts SITE_MANAGER and PROJECT_MANAGER (behaviour for SITE_MANAGER is unchanged).
-- 3. Project member management (Q-PM-2) stays with SITE_MANAGER only. PROJECT_MANAGER cannot create,
--    delete or change member roles. The member RPCs from migration 017 are redefined here.
-- Rollback: supabase/rollbacks/20260923000018_project_manager_role.down.sql

-- Permission keys are normally seeded after migrations; insert the ones used here so this migration is self-contained.
insert into public.permissions (key, description, scope) values
  ('project.read', 'View projects of the tenant', 'ORGANIZATION'),
  ('project.write', 'Create or update projects', 'ORGANIZATION'),
  ('contractor.read', 'View contractors', 'ORGANIZATION'),
  ('contractor.write', 'Manage contractors', 'ORGANIZATION'),
  ('report.export', 'Export reports', 'GLOBAL')
on conflict (key) do nothing;

insert into public.roles (name, description) values
  ('PROJECT_MANAGER', 'Project manager of a MAIN_CONTRACTOR: manages project companies and assigns work within the project.')
on conflict (name) do nothing;

insert into public.role_permissions (role_name, permission_key) values
  ('PROJECT_MANAGER', 'project.read'),
  ('PROJECT_MANAGER', 'project.write'),
  ('PROJECT_MANAGER', 'contractor.read'),
  ('PROJECT_MANAGER', 'contractor.write'),
  ('PROJECT_MANAGER', 'report.export')
on conflict (role_name, permission_key) do nothing;

create or replace function public.is_main_contractor_manager(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_memberships pm
    join public.projects p
      on p.id = pm.project_id
    join public.project_companies pc
      on pc.project_id = pm.project_id and pc.tenant_id = pm.tenant_id
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role in ('SITE_MANAGER', 'PROJECT_MANAGER')
      and pc.participation_type = 'MAIN_CONTRACTOR'
      and p.deleted_at is null
  )
$$;

create or replace function public.is_main_contractor_site_manager(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_memberships pm
    join public.projects p
      on p.id = pm.project_id
    join public.project_companies pc
      on pc.project_id = pm.project_id and pc.tenant_id = pm.tenant_id
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role = 'SITE_MANAGER'
      and pc.participation_type = 'MAIN_CONTRACTOR'
      and p.deleted_at is null
  )
$$;

create or replace function public.assert_member_manager(p_project_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_main_contractor_site_manager(p_project_id) then
    raise exception 'not allowed to manage project members' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.add_project_member(
  p_project_id uuid,
  p_project_company_id uuid,
  p_user_id uuid,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company record;
  v_id uuid;
  v_main_tenant uuid;
begin
  perform public.assert_member_manager(p_project_id);
  v_main_tenant := public.project_main_contractor_tenant(p_project_id);

  select pc.tenant_id, pc.status
    into v_company
  from public.project_companies pc
  where pc.id = p_project_company_id and pc.project_id = p_project_id;

  if not found then
    raise exception 'company does not take part in this project' using errcode = '22023';
  end if;
  if v_company.status <> 'ACTIVE' then
    raise exception 'company is not active in this project' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.user_id = p_user_id and m.tenant_id = v_company.tenant_id
  ) then
    raise exception 'user is not a member of the company tenant' using errcode = '22023';
  end if;

  insert into public.project_memberships (user_id, project_id, tenant_id, role, scope)
  values (p_user_id, p_project_id, v_company.tenant_id, p_role, 'PROJECT_COMPANY')
  returning id into v_id;

  perform public.write_audit(
    'project_member.added', 'project_membership', v_id::text,
    v_main_tenant, p_project_id, p_project_company_id,
    jsonb_build_object('target_user_id', p_user_id, 'role_after', p_role), null
  );
  return v_id;
end;
$$;

create or replace function public.remove_project_member(p_project_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_main_tenant uuid;
begin
  select pm.project_id, pm.tenant_id, pm.user_id, pm.role
    into v_row
  from public.project_memberships pm
  where pm.id = p_project_membership_id
  for update;

  if not found then
    raise exception 'project membership not found' using errcode = 'P0002';
  end if;

  perform public.assert_member_manager(v_row.project_id);
  v_main_tenant := public.project_main_contractor_tenant(v_row.project_id);

  delete from public.project_memberships where id = p_project_membership_id;

  perform public.write_audit(
    'project_member.removed', 'project_membership', p_project_membership_id::text,
    v_main_tenant, v_row.project_id, null,
    jsonb_build_object('target_user_id', v_row.user_id, 'role_before', v_row.role), null
  );
end;
$$;

revoke execute on function public.is_main_contractor_site_manager(uuid) from public, anon, authenticated;
revoke execute on function public.assert_member_manager(uuid) from public, anon, authenticated;
revoke execute on function public.add_project_member(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.remove_project_member(uuid) from public, anon;

grant execute on function public.add_project_member(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.remove_project_member(uuid) to authenticated;
