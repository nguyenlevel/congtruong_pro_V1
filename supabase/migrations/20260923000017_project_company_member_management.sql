-- Migration 017 (VS-01): project companies and project members management.
-- Writes to project_companies and project_memberships are only possible through these
-- RPCs (no insert/update/delete policy exists on those tables).
-- Authorization is checked in the database: the caller must be a SITE_MANAGER of the
-- MAIN_CONTRACTOR company of a live (not soft-deleted) project.
-- Each RPC writes an audit row through write_audit(). The audit tenant is always the
-- MAIN_CONTRACTOR tenant of the project, which the caller belongs to.
-- Rollback: supabase/rollbacks/20260923000017_project_company_member_management.down.sql

create or replace function public.project_main_contractor_tenant(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pc.tenant_id
  from public.project_companies pc
  where pc.project_id = p_project_id and pc.participation_type = 'MAIN_CONTRACTOR'
$$;

create or replace function public.assert_project_manager(p_project_id uuid)
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
  if not public.is_main_contractor_manager(p_project_id) then
    raise exception 'not allowed to manage this project' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.add_project_company(
  p_project_id uuid,
  p_tenant_id uuid,
  p_participation_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_main_tenant uuid;
begin
  perform public.assert_project_manager(p_project_id);

  if p_participation_type not in ('SUBCONTRACTOR', 'OTHER') then
    raise exception 'participation type must be SUBCONTRACTOR or OTHER' using errcode = '22023';
  end if;

  v_main_tenant := public.project_main_contractor_tenant(p_project_id);

  insert into public.project_companies (project_id, tenant_id, participation_type, status)
  values (p_project_id, p_tenant_id, p_participation_type, 'ACTIVE')
  returning id into v_id;

  perform public.write_audit(
    'project_company.added', 'project_company', v_id::text,
    v_main_tenant, p_project_id, v_id, '{}'::jsonb, null
  );
  return v_id;
end;
$$;

create or replace function public.update_project_company(
  p_project_company_id uuid,
  p_participation_type text default null,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_type text;
  v_status text;
  v_main_tenant uuid;
begin
  select pc.project_id, pc.participation_type, pc.status
    into v_project_id, v_type, v_status
  from public.project_companies pc
  where pc.id = p_project_company_id
  for update;

  if not found then
    raise exception 'project company not found' using errcode = 'P0002';
  end if;

  perform public.assert_project_manager(v_project_id);
  v_main_tenant := public.project_main_contractor_tenant(v_project_id);

  if v_type = 'MAIN_CONTRACTOR' and (p_status is not null and p_status <> 'ACTIVE') then
    raise exception 'the main contractor cannot be suspended or ended' using errcode = '22023';
  end if;

  if p_participation_type is not null and v_type <> 'MAIN_CONTRACTOR' then
    if p_participation_type not in ('SUBCONTRACTOR', 'OTHER') then
      raise exception 'participation type must be SUBCONTRACTOR or OTHER' using errcode = '22023';
    end if;
    if p_participation_type <> v_type then
      update public.project_companies
        set participation_type = p_participation_type
        where id = p_project_company_id;
      perform public.write_audit(
        'project_company.type_changed', 'project_company', p_project_company_id::text,
        v_main_tenant, v_project_id, p_project_company_id, '{}'::jsonb, null
      );
    end if;
  end if;

  if p_status is not null and p_status <> v_status then
    if p_status not in ('ACTIVE', 'SUSPENDED', 'ENDED') then
      raise exception 'invalid project company status' using errcode = '22023';
    end if;
    update public.project_companies
      set status = p_status
      where id = p_project_company_id;
    perform public.write_audit(
      case p_status
        when 'ACTIVE' then 'project_company.activated'
        when 'SUSPENDED' then 'project_company.suspended'
        else 'project_company.ended'
      end,
      'project_company', p_project_company_id::text,
      v_main_tenant, v_project_id, p_project_company_id, '{}'::jsonb, null
    );
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
  perform public.assert_project_manager(p_project_id);
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

  perform public.assert_project_manager(v_row.project_id);
  v_main_tenant := public.project_main_contractor_tenant(v_row.project_id);

  delete from public.project_memberships where id = p_project_membership_id;

  perform public.write_audit(
    'project_member.removed', 'project_membership', p_project_membership_id::text,
    v_main_tenant, v_row.project_id, null,
    jsonb_build_object('target_user_id', v_row.user_id, 'role_before', v_row.role), null
  );
end;
$$;

revoke execute on function public.project_main_contractor_tenant(uuid) from public, anon, authenticated;
revoke execute on function public.assert_project_manager(uuid) from public, anon;
revoke execute on function public.add_project_company(uuid, uuid, text) from public, anon;
revoke execute on function public.update_project_company(uuid, text, text) from public, anon;
revoke execute on function public.add_project_member(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.remove_project_member(uuid) from public, anon;

grant execute on function public.add_project_company(uuid, uuid, text) to authenticated;
grant execute on function public.update_project_company(uuid, text, text) to authenticated;
grant execute on function public.add_project_member(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.remove_project_member(uuid) to authenticated;
