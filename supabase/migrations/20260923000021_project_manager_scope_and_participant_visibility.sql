-- Migration 021 (DB-SEC-01 / DB-SEC-03, owner-approved 2026-11-23).
-- Rollback: supabase/rollbacks/20260923000021_project_manager_scope_and_participant_visibility.down.sql
--
-- 1. DB-SEC-01: a PROJECT_MANAGER may assign, change or remove only WORKER and PROJECT_VIEWER.
--    Previously it could assign any role (for example SYS_ADMIN or SUB_CONTRACTOR).
--    SITE_MANAGER (legacy) behaviour is unchanged.
-- 2. DB-SEC-03: a company participating in a project (any project_companies status) can read that
--    project row, but only while the project is not soft-deleted. Write policies on projects are
--    not changed, so participation grants no administrative right. Module data (workers,
--    attendance) is NOT widened by this migration.

create or replace function public.assert_can_touch_role(p_project_id uuid, p_role text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.project_member_manager_level(p_project_id) = 'PROJECT_MANAGER'
     and p_role not in ('WORKER', 'PROJECT_VIEWER') then
    raise exception 'project manager cannot assign or change this role' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.is_participating_company(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_companies pc
    join public.projects p
      on p.id = pc.project_id
    where pc.project_id = p_project_id
      and pc.tenant_id = public.current_tenant_id()
      and p.deleted_at is null
  )
$$;

revoke execute on function public.is_participating_company(uuid) from public, anon;
grant execute on function public.is_participating_company(uuid) to authenticated;

drop policy "projects visible within own tenant when not deleted" on public.projects;

create policy "projects visible to owner or participating company when not deleted"
on public.projects for select to authenticated
using (
  deleted_at is null
  and (
    tenant_id = public.current_tenant_id()
    or public.is_participating_company(id)
  )
);
