-- DB-SEC-04: write_audit action allowlist.
-- Redefines write_audit (same signature) based on the effective definition in
-- 20260923000012_is_project_member_soft_delete.sql. Every existing check is kept;
-- the only addition is the action allowlist, checked right after the actor check.
-- Allowlist = the actions emitted by the RPCs in migrations 017 and 020 (see the
-- ALLOWED list in docs/adr/ADR-009-write-audit-action-allowlist.md).
-- Rollback: supabase/rollbacks/20260925000023_write_audit_action_allowlist.down.sql

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
