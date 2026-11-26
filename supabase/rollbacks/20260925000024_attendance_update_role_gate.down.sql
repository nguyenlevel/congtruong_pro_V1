-- Rollback for 20260925000024_attendance_update_role_gate.sql
-- Restores the tenant-only UPDATE policy from migration 019.

drop policy if exists "attendance update by attendance managers" on public.attendance;

create policy "attendance update within own tenant"
on public.attendance for update to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());
