-- Rollback for 20260925000026_roster_rbac.sql.
-- Drops the additive policies and helpers. workers.user_id is kept only if it holds data
-- that is not yet archived: the rollback refuses to drop a column that still has values.

drop policy if exists "attendance select by roster roles" on public.attendance;
drop policy if exists "attendance select own rows" on public.attendance;
create policy "attendance select within own tenant"
on public.attendance for select to authenticated
using (tenant_id = public.current_tenant_id());
drop policy if exists "workers select own record" on public.workers;
drop policy if exists "workers select by project managers of participating companies" on public.workers;
drop function if exists public.is_own_worker(uuid);
drop function if exists public.can_read_company_roster(uuid);
drop index if exists public.workers_tenant_user_unique;

do $$
begin
  if exists (select 1 from public.workers where user_id is not null) then
    raise exception 'workers.user_id has values; archive them before dropping the column';
  end if;
end;
$$;

alter table public.workers drop column if exists user_id;
