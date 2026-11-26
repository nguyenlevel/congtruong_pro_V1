-- Migration 020: PROJECT_MANAGER of a MAIN_CONTRACTOR manages project members (owner decision, ADR-001 Q-PM-2 amended).
-- Migrations 017-019 are not edited. This migration redefines add_project_member and remove_project_member
-- and adds update_project_member_role.
-- Rules enforced in the database:
-- 1. SITE_MANAGER (legacy) keeps its previous behaviour: any role, any project member.
-- 2. PROJECT_MANAGER of the MAIN_CONTRACTOR may manage members only of projects it is assigned to.
-- 3. PROJECT_MANAGER cannot grant, change or remove SITE_MANAGER or PROJECT_MANAGER memberships.
-- 4. Only project_memberships is changed. The tenant-level memberships (COMPANY scope) are never touched.

create or replace function public.project_member_manager_level(p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_main_contractor_site_manager(p_project_id) then 'SITE_MANAGER'
    when public.is_main_contractor_manager(p_project_id) then 'PROJECT_MANAGER'
    else null
  end
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
  if public.project_member_manager_level(p_project_id) is null then
    raise exception 'not allowed to manage project members' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.assert_can_touch_role(p_project_id uuid, p_role text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.project_member_manager_level(p_project_id) = 'PROJECT_MANAGER'
     and p_role in ('SITE_MANAGER', 'PROJECT_MANAGER') then
    raise exception 'project manager cannot assign or change this role' using errcode = '42501';
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
  perform public.assert_can_touch_role(p_project_id, p_role);
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

create or replace function public.update_project_member_role(
  p_project_membership_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_main_tenant uuid;
begin
  select pm.project_id, pm.user_id, pm.role
    into v_row
  from public.project_memberships pm
  where pm.id = p_project_membership_id
  for update;

  if not found then
    raise exception 'project membership not found' using errcode = 'P0002';
  end if;

  perform public.assert_member_manager(v_row.project_id);
  perform public.assert_can_touch_role(v_row.project_id, v_row.role);
  perform public.assert_can_touch_role(v_row.project_id, p_role);

  if v_row.role = p_role then
    return;
  end if;

  v_main_tenant := public.project_main_contractor_tenant(v_row.project_id);

  update public.project_memberships
     set role = p_role
   where id = p_project_membership_id;

  perform public.write_audit(
    'project_member.role_updated', 'project_membership', p_project_membership_id::text,
    v_main_tenant, v_row.project_id, null,
    jsonb_build_object('target_user_id', v_row.user_id, 'role_before', v_row.role, 'role_after', p_role), null
  );
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
  perform public.assert_can_touch_role(v_row.project_id, v_row.role);
  v_main_tenant := public.project_main_contractor_tenant(v_row.project_id);

  delete from public.project_memberships where id = p_project_membership_id;

  perform public.write_audit(
    'project_member.removed', 'project_membership', p_project_membership_id::text,
    v_main_tenant, v_row.project_id, null,
    jsonb_build_object('target_user_id', v_row.user_id, 'role_before', v_row.role), null
  );
end;
$$;

revoke execute on function public.project_member_manager_level(uuid) from public, anon, authenticated;
revoke execute on function public.assert_can_touch_role(uuid, text) from public, anon, authenticated;
revoke execute on function public.update_project_member_role(uuid, text) from public, anon;
grant execute on function public.update_project_member_role(uuid, text) to authenticated;
