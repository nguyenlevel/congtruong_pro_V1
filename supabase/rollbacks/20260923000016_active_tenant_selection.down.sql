-- Rollback 016: restore the migration 004 hook body exactly, then drop the tenant selection objects.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  membership record;
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
begin
  select m.tenant_id, m.role
    into membership
    from public.memberships m
   where m.user_id = (event ->> 'user_id')::uuid
   order by m.created_at, m.id
   limit 1;

  if found then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(membership.tenant_id::text));
    claims := jsonb_set(claims, '{app_role}', to_jsonb(membership.role));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

drop function if exists public.select_active_tenant(uuid);
drop table if exists public.user_active_tenant;
