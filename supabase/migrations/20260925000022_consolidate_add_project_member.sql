-- DB-SEC-06: consolidate add_project_member into a single definition.
-- add_project_member(uuid, uuid, uuid, text) was created by migrations 017, 018 and 020.
-- 020 is the effective body; 017/018 are kept unchanged as history.
-- This migration re-declares the 020 body once, with explicit privileges, so the
-- effective definition is no longer dependent on migration ordering.
-- Behaviour is unchanged: same rules as 020 (PROJECT_MANAGER of MAIN_CONTRACTOR only,
-- cannot assign SITE_MANAGER/PROJECT_MANAGER, ACTIVE company only, tenant membership required).
-- Rollback: supabase/rollbacks/20260925000022_consolidate_add_project_member.down.sql

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

revoke execute on function public.add_project_member(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.add_project_member(uuid, uuid, uuid, text) to authenticated;
