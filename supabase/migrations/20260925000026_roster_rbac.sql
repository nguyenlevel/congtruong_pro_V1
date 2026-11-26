-- 026: roster access for PROJECT_MANAGER and WORKER (owner decision 2026-11-25, PO-03).
--  * workers.user_id links a roster record to an auth user (nullable, unique per tenant).
--  * PROJECT_MANAGER (main contractor manager) can READ the roster of every ACTIVE company that
--    takes part in a project they manage (workers.project_id always points to the worker's own
--    tenant project, so participation is resolved through project_companies). Write rules are
--    unchanged (SYS_ADMIN, SITE_MANAGER, SUB_CONTRACTOR).
--  * WORKER can READ only the own roster record and the own attendance rows.
-- Existing SELECT/INSERT/UPDATE/DELETE policies are not changed; policies are additive (OR).
-- Rollback: supabase/rollbacks/20260925000026_roster_rbac.down.sql
-- Behaviour change: the attendance SELECT policy is restricted to roster roles (see below).

alter table public.workers
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists workers_tenant_user_unique
  on public.workers (tenant_id, user_id) where user_id is not null;

create or replace function public.can_read_company_roster(p_worker_tenant_id uuid)
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
      on pc.project_id = pm.project_id
    where pm.user_id = auth.uid()
      and pc.tenant_id = p_worker_tenant_id
      and pc.status = 'ACTIVE'
      and public.is_main_contractor_manager(pm.project_id)
  )
$$;

create or replace function public.is_own_worker(p_worker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workers w
    where w.id = p_worker_id
      and w.user_id = auth.uid()
      and w.deleted_at is null
  )
$$;

revoke execute on function public.can_read_company_roster(uuid) from public, anon;
revoke execute on function public.is_own_worker(uuid) from public, anon;
grant execute on function public.can_read_company_roster(uuid) to authenticated;
grant execute on function public.is_own_worker(uuid) to authenticated;

create policy "workers select by project managers of participating companies"
on public.workers for select to authenticated
using (
  deleted_at is null
  and public.can_read_company_roster(tenant_id)
);

create policy "workers select own record"
on public.workers for select to authenticated
using (
  deleted_at is null
  and user_id = auth.uid()
  and tenant_id = public.current_tenant_id()
);

create policy "attendance select own rows"
on public.attendance for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_own_worker(worker_id)
);

-- The original attendance SELECT policy let every tenant member (including WORKER) read all rows.
-- Align it with the workers SELECT policy: roster roles only; WORKER reads own rows (policy above).
drop policy if exists "attendance select within own tenant" on public.attendance;
create policy "attendance select by roster roles"
on public.attendance for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('SYS_ADMIN', 'PROJECT_VIEWER', 'SITE_MANAGER', 'SUB_CONTRACTOR')
);
