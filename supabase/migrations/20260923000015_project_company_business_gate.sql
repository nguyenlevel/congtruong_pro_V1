-- Migration 015 (P1-03): gate for NEW business operations on a project company.
-- Business writes are allowed only when the company is ACTIVE and the actor is a member of
-- the project. SUSPENDED and ENDED companies keep read access (project_companies policy is
-- unchanged). write_audit is NOT gated by status, so administrative and status-transition
-- events are still recorded.

create or replace function public.can_run_project_company_business_write(p_project_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_companies pc
    where pc.id = p_project_company_id
      and pc.status = 'ACTIVE'
      and public.is_project_member(pc.project_id)
  )
$$;

revoke execute on function public.can_run_project_company_business_write(uuid) from public, anon;
grant execute on function public.can_run_project_company_business_write(uuid) to authenticated;
