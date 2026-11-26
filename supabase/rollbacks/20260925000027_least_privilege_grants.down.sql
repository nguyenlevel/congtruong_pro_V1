-- Rollback for 20260925000027_least_privilege_grants.sql.
-- Restores the Supabase default grants for anon and authenticated on public tables.

grant all on all tables in schema public to anon;
grant truncate, references, trigger on all tables in schema public to authenticated;

alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public
  grant truncate, references, trigger on tables to authenticated;
