-- Migration 016: tenant switcher (MVP). The selected tenant is a UI/session selector only.
-- Authorization stays in the database: current_tenant_id() still requires a live row in
-- public.memberships. Revoking membership deletes the row here too (composite FK, cascade),
-- so a stale selection or a stale JWT claim cannot grant access.

create table public.user_active_tenant (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null,
  updated_at timestamptz not null default now(),
  constraint user_active_tenant_membership_fk
    foreign key (user_id, tenant_id)
    references public.memberships (user_id, tenant_id)
    on delete cascade
);

alter table public.user_active_tenant enable row level security;

create policy "active tenant readable by owner"
on public.user_active_tenant for select to authenticated
using (user_id = auth.uid());

create policy "active tenant readable by the auth hook"
on public.user_active_tenant for select to supabase_auth_admin
using (true);

revoke all on table public.user_active_tenant from public, anon, authenticated;
grant select on table public.user_active_tenant to authenticated, supabase_auth_admin;

-- Only path to change the selection. Membership is verified against the database.
create or replace function public.select_active_tenant(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.user_id = v_user and m.tenant_id = p_tenant_id
  ) then
    raise exception 'not a member of this tenant' using errcode = '42501';
  end if;

  insert into public.user_active_tenant (user_id, tenant_id, updated_at)
  values (v_user, p_tenant_id, now())
  on conflict (user_id) do update
    set tenant_id = excluded.tenant_id, updated_at = excluded.updated_at;

  return p_tenant_id;
end;
$$;

revoke execute on function public.select_active_tenant(uuid) from public, anon;
grant execute on function public.select_active_tenant(uuid) to authenticated;

-- Hook: prefer the selected tenant when it is still a live membership; otherwise fall back
-- to the first membership (unchanged behaviour for users with one tenant).
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
    left join public.user_active_tenant a
      on a.user_id = m.user_id and a.tenant_id = m.tenant_id
   where m.user_id = (event ->> 'user_id')::uuid
   order by (a.user_id is not null) desc, m.created_at, m.id
   limit 1;

  if found then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(membership.tenant_id::text));
    claims := jsonb_set(claims, '{app_role}', to_jsonb(membership.role));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;
