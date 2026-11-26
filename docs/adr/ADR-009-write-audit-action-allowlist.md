# ADR-009: write_audit action allowlist and add_project_member consolidation

Status: PENDING_ACCEPTANCE (chờ chủ dự án xác nhận. Chưa ACCEPTED.)

## Context

Addendum (DB-SEC-05, attendance): migration `20260925000024_attendance_update_role_gate.sql` thay policy UPDATE của `attendance` bằng quyền SYS_ADMIN, SITE_MANAGER, SUB_CONTRACTOR, khớp INSERT. Rollback có trong `supabase/rollbacks/`. pgTAP: `attendance_update_role_gate.test.sql`.

Audit DB-SEC-06 và DB-SEC-04 phát hiện:

- `add_project_member(uuid,uuid,uuid,text)` được `create or replace` ở 3 migration: 017, 018, 020. Migration 020 là bản có hiệu lực. Các bản cũ không bị sai về quyền, nhưng trùng lặp làm khó kiểm soát.
- `write_audit` là SECURITY DEFINER, cấp EXECUTE cho `authenticated`, và trước đây không kiểm tra `p_action`. Bất kỳ chuỗi nào cũng được ghi vào `audit_log`, làm loãng ý nghĩa audit.

## Decisions

1. Consolidation `add_project_member` (migration `20260925000022_consolidate_add_project_member.sql`):
   - Thân hàm giữ nguyên bản của 020 (không đổi hành vi).
   - Khai báo lại REVOKE từ `public, anon` và GRANT cho `authenticated` một lần duy nhất.
   - Không chỉnh sửa migration 017, 018, 020 đã áp dụng.
   - Rollback `supabase/rollbacks/20260925000022_consolidate_add_project_member.down.sql` khôi phục đúng thân hàm 020 (no-op về hành vi).
2. Allowlist `write_audit` (migration `20260925000023_write_audit_action_allowlist.sql`):
   - Giữ nguyên toàn bộ kiểm tra membership, project status và tenant của migration 012.
   - Thêm kiểm tra allowlist ngay sau kiểm tra actor. Action ngoài danh sách bị từ chối với `22023 'audit action is not allowed'`.
   - Allowlist chỉ gồm 8 action do các RPC production phát ra:
     - `project_company.added`, `project_company.type_changed`, `project_company.activated`, `project_company.suspended`, `project_company.ended`
     - `project_member.added`, `project_member.role_updated`, `project_member.removed`
   - Không mở rộng allowlist để làm test PASS. Action mới có ý nghĩa nghiệp vụ phải được duyệt riêng.
   - Rollback `supabase/rollbacks/20260925000023_write_audit_action_allowlist.down.sql` khôi phục thân hàm migration 012.
3. Không có action nào bị loại khỏi production. Web, Mobile và packages không gọi `write_audit` trực tiếp. Các giá trị `REF`, `WA`, `TEST`, `SDV_STATUS_CHANGE` chỉ xuất hiện trong fixture test và đã được đổi sang action hợp lệ.

## Consequences

- Risk: caller mới muốn ghi action khác sẽ bị lỗi `22023` cho tới khi allowlist được cập nhật qua migration và được duyệt.
- Không thay đổi quyền PROJECT_MANAGER, SUBCONTRACTOR, SITE_MANAGER hay COMPANY_ADMIN.

## Verification

- `supabase test db`: 19 file, 188 test PASS (trước đó 18 file, 171 test). File mới: `supabase/tests/rls/add_project_member_and_write_audit_hardening.test.sql`.
- Kiểm tra local: một overload mỗi hàm; SECURITY DEFINER; `search_path=""`; `authenticated` có EXECUTE; `anon` và `public` không có EXECUTE.
