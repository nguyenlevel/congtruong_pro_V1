-- 019. Attendance records (Module 3 — Chấm công & Vị trí).
-- One row per worker per work day per tenant (unique constraint below).
-- RLS uses the DB-validated tenant context (ADR-008, migration 014):
-- current_tenant_id() / current_app_role() — never raw JWT claims.

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  worker_id uuid not null references public.workers(id) on delete cascade,
  work_date date not null,
  status text not null default 'PRESENT'
    check (status in ('PRESENT', 'ABSENT', 'ON_LEAVE', 'HALF_DAY')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version >= 1),
  -- Natural key: a worker has at most one attendance record per day per tenant.
  unique (tenant_id, worker_id, work_date)
);

create index idx_attendance_tenant_work_date on public.attendance (tenant_id, work_date);
create index idx_attendance_worker_id on public.attendance (worker_id);
create index idx_attendance_project_id on public.attendance (project_id);
create index idx_attendance_tenant_updated_at on public.attendance (tenant_id, updated_at);

create trigger attendance_set_updated_at before update on public.attendance
for each row execute function public.set_updated_at();

alter table public.attendance enable row level security;

-- SELECT: only rows belonging to the caller's DB-validated tenant.
create policy "attendance select within own tenant"
on public.attendance for select to authenticated
using (tenant_id = public.current_tenant_id());

-- INSERT: tenant-bound + role-gated + worker must belong to the same tenant.
create policy "attendance insert by tenant managers"
on public.attendance for insert to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('SYS_ADMIN', 'SITE_MANAGER', 'SUB_CONTRACTOR')
  and exists (
    select 1 from public.workers w
    where w.id = attendance.worker_id
      and w.tenant_id = attendance.tenant_id
      and w.deleted_at is null
  )
);

-- UPDATE: cannot move a row across tenants.
create policy "attendance update within own tenant"
on public.attendance for update to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- DELETE: hard delete is manager-only; soft delete is preferred via UPDATE.
create policy "attendance delete by tenant managers"
on public.attendance for delete to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('SYS_ADMIN', 'SITE_MANAGER')
);