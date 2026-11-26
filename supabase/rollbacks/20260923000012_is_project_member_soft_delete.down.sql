-- Rollback for 20260923000012_is_project_member_soft_delete.sql.
-- Restores is_project_member exactly as defined in 20260923000009_project_memberships.sql
-- and write_audit exactly as defined in 20260923000011_audit_log_reference_check.sql,
-- including their ACLs.

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_memberships pm
    where pm.project_id = p_project_id and pm.user_id = auth.uid()
  )
$$;

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
    if not public.is_project_member(p_project_id) then
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
revoke execute on function public.is_project_member(uuid) from public, anon;
grant execute on function public.is_project_member(uuid) to authenticated;
