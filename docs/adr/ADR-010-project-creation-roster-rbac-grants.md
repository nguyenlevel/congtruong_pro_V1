# ADR-010: Project creation, invites, roster RBAC and least-privilege grants

Status: PENDING_ACCEPTANCE (chờ chủ dự án xác nhận. Chưa ACCEPTED.)

## Context

`docs/ai-audit/FULL_PROJECT_AUDIT.md` (AUD-04, AUD-09, AUD-14) found: no way to create a project or onboard a user outside SQL, `PROJECT_MANAGER` and `WORKER` unable to read roster data, `attendance` readable by every tenant member, and table grants broader than needed. The owner decided on 2026-11-25 (PO-02, PO-03).

## Decisions

1. Migration `20260925000025_create_project_and_invite.sql`
   - `create_project(name, address, organization_id)`: tenant role `SYS_ADMIN`, `SITE_MANAGER` or `PROJECT_MANAGER`. The tenant becomes MAIN_CONTRACTOR (existing trigger). The creator gets a project membership (`PROJECT_MANAGER`, or `SITE_MANAGER` for a SITE_MANAGER) so they can manage members. Audited as `project.created`.
   - `write_audit` allowlist gains `project.created` (extends ADR-009; the other 8 actions are unchanged).
   - `prepare_project_invite()` (authenticated pre-check) and service-only `find_user_id_by_email()` / `service_grant_tenant_membership()`, used by the `invite-member` Edge Function. Invites only create a tenant membership inside the caller's own tenant, only for `WORKER` or `PROJECT_VIEWER`. The service key never reaches a client.
2. Migration `20260925000026_roster_rbac.sql`
   - `workers.user_id` (nullable, unique per tenant) links a roster record to an auth user.
   - `PROJECT_MANAGER` of the main contractor reads the roster (SELECT only) of ACTIVE companies in projects they manage. `workers.project_id` always refers to the worker's own tenant project, so participation is resolved through `project_companies`.
   - `WORKER` reads only the own roster record and own attendance.
   - The attendance SELECT policy was tenant-wide for any role. It now follows the workers SELECT policy (SYS_ADMIN, PROJECT_VIEWER, SITE_MANAGER, SUB_CONTRACTOR) plus the WORKER own-row policy. Write rules are unchanged.
   - Limitation: RLS is row-level, so the PM sees all roster columns (code, name, phone, status). The table holds no other personal data yet; revisit when HRM fields are added.
3. Migration `20260925000027_least_privilege_grants.sql`: `anon` loses all table grants in `public`; `authenticated` loses TRUNCATE, REFERENCES, TRIGGER. Default privileges for tables created later by `postgres` are aligned.

## Rollback

`supabase/rollbacks/20260925000025…027_*.down.sql`. Rollback of 026 refuses to drop `workers.user_id` while it holds values.

## Verification

- pgTAP `create_project_and_invite.test.sql` (19), `roster_rbac_and_grants.test.sql` (16). `supabase test db`: 23 file / 228 test PASS (local).
- Rollback of 026/027 executed on the local DB and re-applied.

## Not verified

Hosted Supabase; the Edge Function against a real deployment.
