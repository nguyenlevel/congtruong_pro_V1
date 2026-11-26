-- Rollback for migration 20260923000020_project_manager_members.
-- Restores the migration 018 bodies of assert_member_manager, add_project_member and
-- remove_project_member, then drops the objects added by migration 020.
-- No data, role, or project_memberships row is changed.

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

drop function if exists public.update_project_member_role(uuid, text);
drop function if exists public.assert_can_touch_role(uuid, text);
drop function if exists public.project_member_manager_level(uuid);
