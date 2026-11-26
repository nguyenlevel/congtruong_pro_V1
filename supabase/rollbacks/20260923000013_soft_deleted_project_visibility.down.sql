-- Rollback for migration 013: restores the projects SELECT policy from 004 and the
-- is_main_contractor_manager body from 009. ACL is restored to the same state it had before 013.
-- Run this BEFORE the 014 rollback (reverse order).

drop policy "projects visible within own tenant when not deleted" on public.projects;

create policy "projects visible within own tenant"
on public.projects for select to authenticated
using (tenant_id = public.current_tenant_id());

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
    join public.project_companies pc
      on pc.project_id = pm.project_id and pc.tenant_id = pm.tenant_id
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role = 'SITE_MANAGER'
      and pc.participation_type = 'MAIN_CONTRACTOR'
  )
$$;

revoke execute on function public.is_main_contractor_manager(uuid) from public, anon;
grant execute on function public.is_main_contractor_manager(uuid) to authenticated, service_role;
