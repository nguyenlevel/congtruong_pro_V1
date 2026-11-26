-- Rollback for migration 015: removes the project company business-write gate helper.

drop function if exists public.can_run_project_company_business_write(uuid);
