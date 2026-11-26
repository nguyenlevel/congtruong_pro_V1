-- Rollback 017: drop the project company and member management RPCs.
-- No table, row or audit_log entry is removed. Rows created through these RPCs stay in place.

drop function if exists public.remove_project_member(uuid);
drop function if exists public.add_project_member(uuid, uuid, uuid, text);
drop function if exists public.update_project_company(uuid, text, text);
drop function if exists public.add_project_company(uuid, uuid, text);
drop function if exists public.assert_project_manager(uuid);
drop function if exists public.project_main_contractor_tenant(uuid);
