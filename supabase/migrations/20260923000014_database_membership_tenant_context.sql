-- Migration 014 (P1-04): the database is the source of truth for tenant membership.
-- The JWT `tenant_id` claim is only a selector among the tenants the user really belongs to.
-- current_tenant_id() returns the claimed tenant only when memberships confirms it for auth.uid(),
-- otherwise NULL (deny). current_app_role() returns the role stored in memberships for that
-- tenant, so a forged `app_role` claim has no effect. Both functions run as SECURITY DEFINER
-- (owner bypasses RLS) so that the memberships policies do not recurse.

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.tenant_id = nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.user_id = auth.uid()
    and m.tenant_id = public.current_tenant_id()
$$;
