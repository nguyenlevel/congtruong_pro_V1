-- 025: project creation and invite support (owner decision 2026-11-25, PO-02).
-- 1. create_project(): PROJECT_MANAGER, SITE_MANAGER or SYS_ADMIN of the active tenant creates a
--    project. The tenant becomes MAIN_CONTRACTOR (existing trigger) and the creator becomes a
--    project member who can manage members. The action is audited.
-- 2. can_manage_project_members(): boolean wrapper used by the web UI and the invite function.
-- 3. prepare_project_invite(): authenticated pre-check for the invite-member Edge Function.
--    An invite may only create tenant membership inside the caller's own tenant.
-- 4. service_grant_tenant_membership() / find_user_id_by_email(): service_role only.
-- 5. write_audit allowlist gains 'project.created' (extends ADR-009; same body as migration 023).
-- Rollback: supabase/rollbacks/20260925000025_create_project_and_invite.down.sql

create or replace function public.write_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_tenant_id uuid,
  p_project_id uuid,
  p_project_company_id uuid,
  p_payload jsonb,
  p_request_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'write_audit requires an authenticated actor' using errcode = '42501';
  end if;
  if p_action is null or p_action not in (
    'project.created',
    'project_company.added',
    'project_company.type_changed',
    'project_company.activated',
    'project_company.suspended',
    'project_company.ended',
    'project_member.added',
    'project_member.role_updated',
    'project_member.removed'
  ) then
    raise exception 'audit action is not allowed' using errcode = '22023';
  end if;
  if p_tenant_id is null and p_project_id is null then
    raise exception 'write_audit requires a tenant or project scope' using errcode = '22023';
  end if;
  if p_project_company_id is not null and p_project_id is null then
    raise exception 'project_company_id requires project_id' using errcode = '22023';
  end if;
  if p_tenant_id is not null and p_tenant_id not in (select public.my_tenant_ids()) then
    raise exception 'actor is not a member of the tenant' using errcode = '42501';
  end if;
  if p_project_id is not null then
    if not exists (
      select 1 from public.project_memberships pm
      where pm.project_id = p_project_id and pm.user_id = v_actor
    ) then
      raise exception 'actor is not a member of the project' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.projects p
      where p.id = p_project_id and p.deleted_at is null
    ) then
      raise exception 'project does not exist or is deleted' using errcode = '22023';
    end if;
    if p_tenant_id is not null and not exists (
      select 1 from public.projects p
      where p.id = p_project_id and p.tenant_id = p_tenant_id
    ) then
      raise exception 'project does not belong to the tenant' using errcode = '22023';
    end if;
    if p_project_company_id is not null and not exists (
      select 1 from public.project_companies pc
      where pc.id = p_project_company_id and pc.project_id = p_project_id
    ) then
      raise exception 'project_company does not belong to the project' using errcode = '22023';
    end if;
  end if;
  if p_payload is null or not public.audit_payload_allowed(p_payload) then
    raise exception 'audit payload contains keys outside the allowlist' using errcode = '22023';
  end if;

  insert into public.audit_log (
    actor_user_id, action, target_type, target_id, tenant_id, project_id,
    project_company_id, payload, request_id
  ) values (
    v_actor, p_action, p_target_type, p_target_id, p_tenant_id, p_project_id,
    p_project_company_id, p_payload, p_request_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.write_audit(text, text, text, uuid, uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.write_audit(text, text, text, uuid, uuid, uuid, jsonb, text) to authenticated;

create or replace function public.can_manage_project_members(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.project_member_manager_level(p_project_id) is not null
$$;

create or replace function public.create_project(
  p_site_name text,
  p_address text default '',
  p_organization_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_role text := public.current_app_role();
  v_project_role text;
  v_name text := btrim(coalesce(p_site_name, ''));
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_tenant is null or v_role is null
     or v_role not in ('SYS_ADMIN', 'SITE_MANAGER', 'PROJECT_MANAGER') then
    raise exception 'not allowed to create projects' using errcode = '42501';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 200 then
    raise exception 'site name must be 1 to 200 characters' using errcode = '22023';
  end if;
  if char_length(coalesce(p_address, '')) > 500 then
    raise exception 'address must be at most 500 characters' using errcode = '22023';
  end if;
  if p_organization_id is not null and not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.tenant_id = v_tenant
  ) then
    raise exception 'organization does not belong to the tenant' using errcode = '22023';
  end if;

  insert into public.projects (tenant_id, organization_id, site_name, address)
  values (v_tenant, p_organization_id, v_name, coalesce(p_address, ''))
  returning id into v_id;

  -- SYS_ADMIN manages members as PROJECT_MANAGER; the project role is never higher than the tenant role.
  v_project_role := case when v_role = 'SITE_MANAGER' then 'SITE_MANAGER' else 'PROJECT_MANAGER' end;
  insert into public.project_memberships (user_id, project_id, tenant_id, role, scope)
  values (auth.uid(), v_id, v_tenant, v_project_role, 'PROJECT');

  perform public.write_audit(
    'project.created', 'project', v_id::text, v_tenant, v_id, null,
    jsonb_build_object('project_id', v_id, 'role_after', v_project_role), null
  );
  return v_id;
end;
$$;

create or replace function public.prepare_project_invite(
  p_project_id uuid,
  p_project_company_id uuid,
  p_role text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company record;
begin
  perform public.assert_member_manager(p_project_id);
  perform public.assert_can_touch_role(p_project_id, p_role);
  if p_role not in ('WORKER', 'PROJECT_VIEWER') then
    raise exception 'invite supports WORKER and PROJECT_VIEWER only' using errcode = '22023';
  end if;
  select pc.tenant_id, pc.status into v_company
  from public.project_companies pc
  where pc.id = p_project_company_id and pc.project_id = p_project_id;
  if not found then
    raise exception 'company does not take part in this project' using errcode = '22023';
  end if;
  if v_company.status <> 'ACTIVE' then
    raise exception 'company is not active in this project' using errcode = '22023';
  end if;
  if v_company.tenant_id is distinct from public.current_tenant_id() then
    raise exception 'invites can only target the caller''s own company' using errcode = '42501';
  end if;
  return v_company.tenant_id;
end;
$$;

create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1
$$;

create or replace function public.service_grant_tenant_membership(
  p_tenant_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role not in ('WORKER', 'PROJECT_VIEWER') then
    raise exception 'invite supports WORKER and PROJECT_VIEWER only' using errcode = '22023';
  end if;
  insert into public.memberships (user_id, tenant_id, role)
  values (p_user_id, p_tenant_id, p_role)
  on conflict (user_id, tenant_id) do nothing;
end;
$$;

revoke execute on function public.can_manage_project_members(uuid) from public, anon;
revoke execute on function public.create_project(text, text, uuid) from public, anon;
revoke execute on function public.prepare_project_invite(uuid, uuid, text) from public, anon;
revoke execute on function public.find_user_id_by_email(text) from public, anon, authenticated;
revoke execute on function public.service_grant_tenant_membership(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.can_manage_project_members(uuid) to authenticated;
grant execute on function public.create_project(text, text, uuid) to authenticated;
grant execute on function public.prepare_project_invite(uuid, uuid, text) to authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;
grant execute on function public.service_grant_tenant_membership(uuid, uuid, text) to service_role;
