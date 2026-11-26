-- 027: least-privilege table grants (AUD-14 / T-31).
-- Every public table uses RLS policies written `to authenticated`; anon needs no table access.
-- TRUNCATE, REFERENCES and TRIGGER are not governed by RLS and are not needed by API roles.
-- Default privileges for tables created later by postgres are aligned.
-- Rollback: supabase/rollbacks/20260925000027_least_privilege_grants.down.sql

revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;
