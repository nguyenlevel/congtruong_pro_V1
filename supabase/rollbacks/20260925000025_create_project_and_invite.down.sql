-- Rollback for 20260925000025_create_project_and_invite.sql.
-- Drops the new functions and restores write_audit from 20260925000023 (without 'project.created').
-- Projects and audit_log rows already created are NOT deleted.

drop function if exists public.service_grant_tenant_membership(uuid, uuid, text);
drop function if exists public.find_user_id_by_email(text);
drop function if exists public.prepare_project_invite(uuid, uuid, text);
drop function if exists public.create_project(text, text, uuid);
drop function if exists public.can_manage_project_members(uuid);

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
