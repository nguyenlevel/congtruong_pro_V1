-- Rollback 018: remove the PROJECT_MANAGER role.
-- Refuses to run while any membership still uses PROJECT_MANAGER. No row of
-- memberships, project_memberships or audit_log is deleted or changed.
-- SITE_MANAGER behaviour is restored to the migration 013 gate. The member RPCs keep
-- calling assert_member_manager, which is SITE_MANAGER-only, so they behave as before.

do $$
begin
  if exists (select 1 from public.memberships where role = 'PROJECT_MANAGER')
     or exists (select 1 from public.project_memberships where role = 'PROJECT_MANAGER') then
    raise exception 'rollback 018 refused: PROJECT_MANAGER is still assigned to memberships';
  end if;
end;
$$;

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

delete from public.role_permissions where role_name = 'PROJECT_MANAGER';
delete from public.roles where name = 'PROJECT_MANAGER';
