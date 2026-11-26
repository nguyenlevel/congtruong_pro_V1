-- DB-SEC-05: attendance UPDATE was allowed to any authenticated member of the tenant
-- (WORKER and PROJECT_VIEWER included). Restrict it to the same roles that may INSERT.
-- Does not change migration 019; Attendance business scope stays DEFERRED.
-- Rollback: 20260925000024_attendance_update_role_gate.down.sql

drop policy if exists "attendance update within own tenant" on public.attendance;

create policy "attendance update by attendance managers"
on public.attendance for update to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('SYS_ADMIN', 'SITE_MANAGER', 'SUB_CONTRACTOR')
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('SYS_ADMIN', 'SITE_MANAGER', 'SUB_CONTRACTOR')
);
