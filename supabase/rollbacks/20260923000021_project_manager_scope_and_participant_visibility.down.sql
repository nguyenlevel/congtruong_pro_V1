-- Rollback for migration 20260923000021_project_manager_scope_and_participant_visibility.
-- Restores the migration 020 body of assert_can_touch_role and the migration 013 projects
-- SELECT policy, then drops is_participating_company. No data is changed.

create or replace function public.assert_can_touch_role(p_project_id uuid, p_role text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.project_member_manager_level(p_project_id) = 'PROJECT_MANAGER'
     and p_role in ('SITE_MANAGER', 'PROJECT_MANAGER') then
    raise exception 'project manager cannot assign or change this role' using errcode = '42501';
  end if;
end;
$$;

drop policy "projects visible to owner or participating company when not deleted" on public.projects;

create policy "projects visible within own tenant when not deleted"
on public.projects for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and deleted_at is null
);

drop function if exists public.is_participating_company(uuid);
