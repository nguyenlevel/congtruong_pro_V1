-- Migration 013 (P1-01 / P1-02): soft-deleted projects are hidden from every ordinary user.
-- 1. projects SELECT requires deleted_at is null (replaces "projects visible within own tenant").
-- 2. is_main_contractor_manager returns FALSE when the project is soft-deleted.
-- No row is deleted and no historical data is changed. Restoring a deleted project is not
-- granted here; it needs its own design.

drop policy "projects visible within own tenant" on public.projects;

create policy "projects visible within own tenant when not deleted"
on public.projects for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and deleted_at is null
);

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
    join public.projects p
      on p.id = pm.project_id
    join public.project_companies pc
      on pc.project_id = pm.project_id and pc.tenant_id = pm.tenant_id
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role = 'SITE_MANAGER'
      and pc.participation_type = 'MAIN_CONTRACTOR'
      and p.deleted_at is null
  )
$$;

revoke execute on function public.is_main_contractor_manager(uuid) from public, anon;
grant execute on function public.is_main_contractor_manager(uuid) to authenticated;
