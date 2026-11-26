-- Rollback for migration 014: restores the original invoker-security current_tenant_id and
-- current_app_role from 004 (JWT-only). ACL is unchanged by 014, so no GRANT/REVOKE is needed.

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.jwt() ->> 'app_role'
$$;
